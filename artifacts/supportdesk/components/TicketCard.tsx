import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import StatusBadge from "./StatusBadge";

interface Ticket {
  id: string;
  productName: string;
  description: string;
  status: "open" | "in-progress" | "resolved";
  priority?: "low" | "medium" | "high" | "critical";
  category?: "bug" | "feature" | "billing" | "account" | "other";
  createdAt: string;
}

const PRIORITY_CONFIG = {
  critical: { color: "#EF4444", label: "Critical", icon: "alert-octagon" as const },
  high:     { color: "#F97316", label: "High",     icon: "alert-triangle" as const },
  medium:   { color: "#EAB308", label: "Medium",   icon: "minus-circle" as const },
  low:      { color: "#64748B", label: "Low",       icon: "arrow-down-circle" as const },
};

const CATEGORY_CONFIG = {
  bug:     { label: "Bug",          icon: "alert-circle" as const },
  feature: { label: "Feature",      icon: "star" as const },
  billing: { label: "Billing",      icon: "credit-card" as const },
  account: { label: "Account",      icon: "user" as const },
  other:   { label: "Other",        icon: "help-circle" as const },
};

function formatAge(isoString: string): string {
  if (!isoString) return "";
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  } catch { return ""; }
}

function formatDate(isoString: string): string {
  if (!isoString) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(isoString));
  } catch {
    return "—";
  }
}

export default function TicketCard({ ticket, index = 0 }: { ticket: Ticket; index?: number }) {
  const colors = useColors();
  const router = useRouter();
  const styles = makeStyles(colors);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(18)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 50, 400);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 340,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        friction: 8,
        tension: 60,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  function onPressIn() {
    Animated.spring(pressScale, { toValue: 0.97, useNativeDriver: true, friction: 8 }).start();
  }
  function onPressOut() {
    Animated.spring(pressScale, { toValue: 1, useNativeDriver: true, friction: 5 }).start();
  }

  const priority = ticket.priority ?? "medium";
  const category = ticket.category ?? "other";
  const pCfg = PRIORITY_CONFIG[priority];
  const cCfg = CATEGORY_CONFIG[category];
  const age = formatAge(ticket.createdAt);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pressScale }],
      }}
    >
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/user-ticket/${ticket.id}` as never)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        <View style={styles.topRow}>
          <View style={styles.topLeft}>
            <View style={[styles.priorityDot, { backgroundColor: pCfg.color }]} />
            <Text style={styles.productName} numberOfLines={1}>{ticket.productName}</Text>
          </View>
          <StatusBadge status={ticket.status} />
        </View>

        <Text style={styles.description} numberOfLines={2}>{ticket.description}</Text>

        <View style={styles.metaRow}>
          <View style={[styles.categoryChip, { borderColor: colors.border }]}>
            <Feather name={cCfg.icon} size={10} color={colors.mutedForeground} />
            <Text style={styles.categoryText}>{cCfg.label}</Text>
          </View>
          <View style={[styles.priorityChip, { borderColor: pCfg.color + "50", backgroundColor: pCfg.color + "12" }]}>
            <Feather name={pCfg.icon} size={10} color={pCfg.color} />
            <Text style={[styles.priorityText, { color: pCfg.color }]}>{pCfg.label}</Text>
          </View>
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.dateRow}>
            <Feather name="clock" size={11} color={colors.mutedForeground} />
            <Text style={styles.dateText}>{formatDate(ticket.createdAt)}</Text>
          </View>
          <View style={styles.rightRow}>
            {ticket.status === "open" && age ? (
              <Text style={[styles.ageText, priority === "critical" && { color: "#EF4444" }]}>{age}</Text>
            ) : null}
            <Text style={styles.idText}>#{ticket.id.slice(-8)}</Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 10,
    },
    topRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 8,
      marginBottom: 8,
    },
    topLeft: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      gap: 8,
    },
    priorityDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      flexShrink: 0,
    },
    productName: {
      fontSize: 15,
      fontWeight: "600" as const,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      flex: 1,
    },
    description: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      lineHeight: 19,
      marginBottom: 10,
    },
    metaRow: {
      flexDirection: "row",
      gap: 6,
      marginBottom: 12,
    },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
      backgroundColor: colors.secondary,
    },
    categoryText: {
      fontSize: 11,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    priorityChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      borderWidth: 1,
    },
    priorityText: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
    },
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    rightRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    ageText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    idText: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
  });
}
