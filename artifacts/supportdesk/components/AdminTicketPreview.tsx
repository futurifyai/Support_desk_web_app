import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useGetAdminTicketDetail } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import StatusBadge from "@/components/StatusBadge";

interface AdminTicketPreviewProps {
  ticketId: string | null;
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export default function AdminTicketPreview({ ticketId }: AdminTicketPreviewProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const router = useRouter();
  const styles = makeStyles(colors, isDark);
  const { data, isLoading, isError, refetch } = useGetAdminTicketDetail(ticketId ?? "");
  const ticket = data?.data;

  if (!ticketId) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIcon}><Feather name="mouse-pointer" size={20} color={colors.primary} /></View>
        <Text style={styles.emptyTitle}>Select a ticket</Text>
        <Text style={styles.emptyBody}>Choose an item from the queue to inspect its details here.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.empty}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.emptyBody}>Loading ticket preview…</Text>
      </View>
    );
  }

  if (isError || !ticket) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, styles.errorIcon]}><Feather name="alert-circle" size={20} color={colors.destructive} /></View>
        <Text style={styles.emptyTitle}>Preview unavailable</Text>
        <Text style={styles.emptyBody}>We could not load this ticket right now.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => void refetch()} activeOpacity={0.8}>
          <Text style={styles.retryLabel}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const latestReply = ticket.replies[ticket.replies.length - 1];
  const initials = ticket.userName.split(" ").map((word) => word[0] ?? "").slice(0, 2).join("").toUpperCase();
  const assignedLabel = ticket.assignedTo ? `Agent · ${ticket.assignedTo.slice(-6)}` : "Unassigned";

  return (
    <View style={styles.root}>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.eyebrow}>Ticket preview</Text>
          <Text style={styles.ticketId}>#{ticket.id.slice(-8)}</Text>
        </View>
        <StatusBadge status={ticket.status} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{ticket.productName}</Text>
          <Text style={styles.created}>Submitted {formatDate(ticket.createdAt)}</Text>
        </View>

        <View style={styles.customerRow}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials || "?"}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.customerName}>{ticket.userName}</Text>
            <Text style={styles.customerEmail}>{ticket.userEmail}</Text>
          </View>
          <View style={styles.priority}>
            <Text style={styles.priorityLabel}>Priority</Text>
            <Text style={[styles.priorityValue, { color: ticket.priority === "critical" || ticket.priority === "high" ? colors.destructive : colors.foreground }]}>
              {ticket.priority[0].toUpperCase() + ticket.priority.slice(1)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Issue summary</Text>
          <Text style={styles.description}>{ticket.description}</Text>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Category</Text>
            <Text style={styles.metaValue}>{ticket.category[0].toUpperCase() + ticket.category.slice(1)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Assigned to</Text>
            <Text style={styles.metaValue}>{assignedLabel}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>Conversation</Text>
            <Text style={styles.metaValue}>{ticket.replies.length} {ticket.replies.length === 1 ? "reply" : "replies"}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>SLA</Text>
            <Text style={[styles.metaValue, { color: ticket.slaEscalated ? colors.destructive : colors.success }]}>
              {ticket.slaEscalated ? "Escalated" : "On track"}
            </Text>
          </View>
        </View>

        {latestReply && (
          <View style={styles.replyCard}>
            <View style={styles.replyHeader}>
              <View style={styles.replyIcon}><Feather name="message-square" size={13} color={colors.primary} /></View>
              <Text style={styles.replyLabel}>Latest reply</Text>
              <Text style={styles.replyDate}>{formatDate(latestReply.createdAt)}</Text>
            </View>
            <Text style={styles.replyAuthor}>{latestReply.authorName}</Text>
            <Text style={styles.replyText} numberOfLines={4}>{latestReply.message}</Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.openButton}
          onPress={() => router.push(`/(admin)/ticket/${ticket.id}`)}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel="Open full ticket detail"
        >
          <Text style={styles.openLabel}>Open full ticket</Text>
          <Feather name="arrow-up-right" size={16} color={colors.primaryForeground} />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.card },
    previewHeader: {
      minHeight: 72,
      paddingHorizontal: 24,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? "rgba(30,41,59,0.72)" : "rgba(248,250,252,0.75)",
    },
    eyebrow: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1, textTransform: "uppercase" },
    ticketId: { color: colors.foreground, fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 3 },
    content: { padding: 24, paddingBottom: 34 },
    titleBlock: { marginBottom: 22 },
    title: { color: colors.foreground, fontSize: 24, lineHeight: 29, fontFamily: "Inter_700Bold", letterSpacing: -0.4 },
    created: { color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 7 },
    customerRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: colors.border },
    avatar: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)" },
    avatarText: { color: colors.primary, fontSize: 13, fontFamily: "Inter_700Bold" },
    customerName: { color: colors.foreground, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    customerEmail: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
    priority: { alignItems: "flex-end" },
    priorityLabel: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" },
    priorityValue: { fontSize: 12, fontFamily: "Inter_700Bold", marginTop: 3 },
    section: { paddingTop: 22 },
    sectionLabel: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 9 },
    description: { color: colors.foreground, fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular" },
    metaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: 22, borderWidth: 1, borderColor: colors.border, borderRadius: 11, overflow: "hidden" },
    metaCell: { width: "50%", minHeight: 68, padding: 12, borderBottomWidth: 1, borderRightWidth: 1, borderColor: colors.border },
    metaLabel: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" },
    metaValue: { color: colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 6 },
    replyCard: { marginTop: 22, padding: 14, borderWidth: 1, borderColor: isDark ? "rgba(99,102,241,0.22)" : "rgba(99,102,241,0.18)", borderRadius: 11, backgroundColor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.05)" },
    replyHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
    replyIcon: { width: 24, height: 24, borderRadius: 7, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.12)" },
    replyLabel: { color: colors.foreground, fontSize: 11, fontFamily: "Inter_700Bold" },
    replyDate: { marginLeft: "auto", color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" },
    replyAuthor: { color: colors.primary, fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 12 },
    replyText: { color: colors.foreground, fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", marginTop: 5 },
    openButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.primary, borderRadius: 9, paddingVertical: 12, marginTop: 24 },
    openLabel: { color: colors.primaryForeground, fontSize: 13, fontFamily: "Inter_700Bold" },
    empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30, gap: 9, backgroundColor: colors.card },
    emptyIcon: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.1)", marginBottom: 4 },
    errorIcon: { backgroundColor: isDark ? "rgba(239,68,68,0.14)" : "rgba(239,68,68,0.08)" },
    emptyTitle: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold" },
    emptyBody: { color: colors.mutedForeground, fontSize: 13, lineHeight: 19, textAlign: "center", fontFamily: "Inter_400Regular", maxWidth: 260 },
    retryButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, marginTop: 4 },
    retryLabel: { color: colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  });
}