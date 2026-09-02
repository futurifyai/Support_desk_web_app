import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Platform,
  TextInput,
  ActivityIndicator,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetAdminTickets } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import StatusBadge from "@/components/StatusBadge";
import AdminHeader, { AdminHeaderIconButton } from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";
import AdminTicketPreview from "@/components/AdminTicketPreview";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard",  label: "Tickets",   icon: "grid",        iconActive: "grid"        },
  { key: "analytics",  label: "Analytics", icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users",     icon: "users",       iconActive: "users"       },
  { key: "access",     label: "Access",    icon: "key",         iconActive: "key"         },
  { key: "audit-log",  label: "Audit",     icon: "shield",      iconActive: "shield"      },
];

type SortKey = "createdAt" | "userName" | "productName" | "status";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "open" | "in-progress" | "resolved";

const COL = { id: 70, user: 140, subject: 150, status: 110, sla: 92, date: 124 };
const TABLE_WIDTH = COL.id + COL.user + COL.subject + COL.status + COL.sla + COL.date + 24;
function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return "—"; }
}

function slaLabel(dueAt: string | null | undefined) {
  if (!dueAt) return { text: "—", color: "#64748B" };
  const hours = (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
  if (hours < 0) return { text: `${Math.ceil(Math.abs(hours))}h overdue`, color: "#EF4444" };
  if (hours < 24) return { text: `${Math.ceil(hours)}h left`, color: "#F59E0B" };
  return { text: `${Math.ceil(hours / 24)}d left`, color: "#22C55E" };
}

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
];

function AnimatedCounter({ value, color, style }: { value: number; color: string; style?: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    Animated.timing(anim, { toValue: value, duration: 700, useNativeDriver: false }).start();
    const id = anim.addListener(({ value: v }) => setDisplayed(Math.round(v)));
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={[style, { color }]}>{displayed}</Text>;
}

export default function AdminDashboard() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const { data, isLoading, isRefetching, refetch, isError } = useGetAdminTickets();
  const allTickets = data?.data ?? [];

  const statsY = useRef(new Animated.Value(14)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;
  const tableOpacity = useRef(new Animated.Value(0)).current;
  const tableY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(statsOpacity, { toValue: 1, duration: 420, delay: 80, useNativeDriver: true }),
      Animated.spring(statsY, { toValue: 0, delay: 80, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(tableOpacity, { toValue: 1, duration: 450, delay: 200, useNativeDriver: true }),
      Animated.spring(tableY, { toValue: 0, delay: 200, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const filtered = useMemo(() => {
    let list = [...allTickets];
    if (statusFilter !== "all") list = list.filter((t) => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) => t.userName.toLowerCase().includes(q) || t.productName.toLowerCase().includes(q) ||
               t.userEmail.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      let av = a[sortKey] as string;
      let bv = b[sortKey] as string;
      if (sortKey === "createdAt") {
        av = String(new Date(av).getTime()).padStart(20, "0");
        bv = String(new Date(bv).getTime()).padStart(20, "0");
      }
      return (sortDir === "asc" ? 1 : -1) * av.localeCompare(bv);
    });
    return list;
  }, [allTickets, statusFilter, search, sortKey, sortDir]);

  useEffect(() => {
    if (!isDesktopWeb || filtered.length === 0) return;
    const selectionIsVisible = selectedTicketId != null && filtered.some((ticket) => ticket.id === selectedTicketId);
    if (!selectionIsVisible) setSelectedTicketId(filtered[0].id);
  }, [filtered, isDesktopWeb, selectedTicketId]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const openCount = allTickets.filter((t) => t.status === "open").length;
  const inProgressCount = allTickets.filter((t) => t.status === "in-progress").length;
  const resolvedCount = allTickets.filter((t) => t.status === "resolved").length;

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="Dashboard"
        rightActions={
          <AdminHeaderIconButton
            icon="refresh-cw"
            accessibilityLabel="Refresh tickets"
            onPress={() => void refetch()}
            disabled={isRefetching}
            loading={isRefetching}
          />
        }
      />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: isDesktopWeb ? 34 : insets.bottom + 110 }}
      >
        <Animated.View style={[s.statsRow, { opacity: statsOpacity, transform: [{ translateY: statsY }] }]}>
          <StatCard label="Total"       value={allTickets.length}  valueColor={colors.foreground}  accentColor={colors.border}           isDark={isDark} />
          <StatCard label="Open"        value={openCount}          valueColor="#A5B4FC"             accentColor="rgba(99,102,241,0.5)"   isDark={isDark} />
          <StatCard label="In Progress" value={inProgressCount}    valueColor="#FCD34D"             accentColor="rgba(245,158,11,0.5)"   isDark={isDark} />
          <StatCard label="Resolved"    value={resolvedCount}      valueColor="#4ADE80"             accentColor="rgba(34,197,94,0.5)"    isDark={isDark} />
        </Animated.View>

        <Animated.View style={{ opacity: tableOpacity, transform: [{ translateY: tableY }] }}>
          <View style={[s.searchWrapper, searchFocused && s.searchFocused]}>
            <Feather name="search" size={15} color={searchFocused ? colors.primary : colors.mutedForeground} />
            <TextInput
              style={s.searchInput}
              placeholder="Search by user, product, or ticket ID…"
              placeholderTextColor={colors.mutedForeground}
              value={search}
              onChangeText={setSearch}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.filterScroll} contentContainerStyle={s.filterContent}>
            {STATUS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[s.filterChip, statusFilter === f.key && s.filterChipActive]}
                onPress={() => setStatusFilter(f.key)}
              >
                <Text style={[s.filterChipText, statusFilter === f.key && s.filterChipTextActive]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

           {isDesktopWeb ? (
             <View style={s.workspace}>
               <View style={s.queuePane}>
                 <View style={s.queueHeader}>
                   <View>
                     <Text style={s.queueTitle}>Ticket queue</Text>
                     <Text style={s.queueSubtitle}>{filtered.length} items requiring attention</Text>
                   </View>
                   <Feather name="list" size={16} color={colors.mutedForeground} />
                 </View>
                 <View style={s.sortBar}>
                   <Text style={s.sortLabel}>Sort by</Text>
                   {[
                     { key: "createdAt" as SortKey, label: "Recent" },
                     { key: "userName" as SortKey, label: "Customer" },
                     { key: "productName" as SortKey, label: "Product" },
                     { key: "status" as SortKey, label: "Status" },
                   ].map((option) => {
                     const active = sortKey === option.key;
                     return (
                       <TouchableOpacity
                         key={option.key}
                         style={[s.sortButton, active && s.sortButtonActive]}
                         onPress={() => toggleSort(option.key)}
                         activeOpacity={0.75}
                         accessibilityRole="button"
                         accessibilityLabel={`Sort by ${option.label}`}
                       >
                         <Text style={[s.sortButtonText, active && s.sortButtonTextActive]}>{option.label}</Text>
                         {active && <Feather name={sortDir === "asc" ? "chevron-up" : "chevron-down"} size={10} color={colors.primary} />}
                       </TouchableOpacity>
                     );
                   })}
                 </View>
                 <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={s.desktopQueueScroll}>
                   {isLoading ? (
                     <View style={s.tableEmpty}>
                       <ActivityIndicator size="small" color={colors.primary} />
                       <Text style={s.tableEmptyText}>Loading tickets…</Text>
                     </View>
                   ) : isError ? (
                     <View style={s.tableEmpty}>
                       <Feather name="alert-circle" size={28} color={colors.destructive} style={{ opacity: 0.5 }} />
                       <Text style={s.tableEmptyText}>Failed to load</Text>
                       <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
                         <Text style={s.retryText}>Retry</Text>
                       </TouchableOpacity>
                     </View>
                   ) : filtered.length === 0 ? (
                     <View style={s.tableEmpty}>
                       <Feather name="inbox" size={30} color={colors.border} />
                       <Text style={s.tableEmptyText}>No tickets found</Text>
                     </View>
                   ) : (
                     filtered.map((ticket) => {
                       const selected = ticket.id === selectedTicketId;
                       const sla = slaLabel(ticket.slaDueAt);
                       return (
                         <TouchableOpacity
                           key={ticket.id}
                           style={[s.queueRow, selected && s.queueRowSelected]}
                           onPress={() => setSelectedTicketId(ticket.id)}
                           activeOpacity={0.74}
                           accessibilityRole="button"
                           accessibilityState={{ selected }}
                           accessibilityLabel={`Preview ticket ${ticket.id.slice(-6)}`}
                         >
                           <View style={s.queueRowTop}>
                             <Text style={[s.cellId, selected && { color: colors.primary }]}>#{ticket.id.slice(-6)}</Text>
                             <Text style={[s.queueDate, selected && { color: colors.foreground }]}>{formatDate(ticket.createdAt)}</Text>
                           </View>
                           <Text style={s.queueSubject} numberOfLines={1}>{ticket.productName}</Text>
                           <View style={s.queueRowBottom}>
                             <Text style={s.queueUser} numberOfLines={1}>{ticket.userName}</Text>
                             <Text style={[s.queueSla, { color: ticket.status === "resolved" ? colors.success : sla.color }]}>
                               {ticket.status === "resolved" ? "Met" : sla.text}
                             </Text>
                           </View>
                           <View style={s.queueStatus}><StatusBadge status={ticket.status as "open" | "in-progress" | "resolved"} /></View>
                         </TouchableOpacity>
                       );
                     })
                   )}
                 </ScrollView>
               </View>
               <View style={s.previewPane}>
                 <AdminTicketPreview ticketId={selectedTicketId} />
               </View>
             </View>
           ) : (
             <View style={s.tableCard}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                 <View style={{ minWidth: TABLE_WIDTH }}>
                <View style={s.tableHeader}>
                  {[
                    { label: "ID", key: "id" as SortKey, w: COL.id },
                    { label: "User", key: "userName" as SortKey, w: COL.user },
                    { label: "Subject", key: "productName" as SortKey, w: COL.subject },
                    { label: "Status", key: "status" as SortKey, w: COL.status },
                    { label: "SLA", key: "createdAt" as SortKey, w: COL.sla },
                    { label: "Date", key: "createdAt" as SortKey, w: COL.date },
                  ].map(({ label, key, w }) => {
                    const active = sortKey === key;
                    return (
                      <TouchableOpacity key={`${label}-${key}`} style={{ width: w, flexDirection: "row", alignItems: "center", gap: 3 }} onPress={() => toggleSort(key)} activeOpacity={0.7}>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: active ? colors.primary : colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5 }}>
                          {label}
                        </Text>
                        {active && <Feather name={sortDir === "asc" ? "chevron-up" : "chevron-down"} size={11} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {isLoading ? (
                  <View style={s.tableEmpty}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={s.tableEmptyText}>Loading tickets…</Text>
                  </View>
                ) : isError ? (
                  <View style={s.tableEmpty}>
                    <Feather name="alert-circle" size={32} color={colors.destructive} style={{ opacity: 0.5 }} />
                    <Text style={s.tableEmptyText}>Failed to load</Text>
                    <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
                      <Text style={s.retryText}>Retry</Text>
                    </TouchableOpacity>
                  </View>
                ) : filtered.length === 0 ? (
                  <View style={s.tableEmpty}>
                    <Feather name="inbox" size={36} color={colors.border} />
                    <Text style={s.tableEmptyText}>No tickets found</Text>
                  </View>
                ) : (
                  filtered.map((ticket, idx) => (
                    <TouchableOpacity
                      key={ticket.id}
                      style={[s.tableRow, idx % 2 === 1 && { backgroundColor: isDark ? "#1A2744" : "#F8FAFC" }]}
                      onPress={() => router.push(`/(admin)/ticket/${ticket.id}`)}
                      activeOpacity={0.6}
                    >
                      <Text style={[s.cellId, { width: COL.id }]} numberOfLines={1}>#{ticket.id.slice(-6)}</Text>
                      <View style={{ width: COL.user, paddingRight: 10 }}>
                        <Text style={s.cellPrimary} numberOfLines={1}>{ticket.userName}</Text>
                        <Text style={s.cellSub} numberOfLines={1}>{ticket.userEmail}</Text>
                      </View>
                      <View style={{ width: COL.subject, paddingRight: 10 }}>
                        <Text style={s.cellPrimary} numberOfLines={1}>{ticket.productName}</Text>
                        <Text style={s.cellSub} numberOfLines={1}>{ticket.description}</Text>
                      </View>
                      <View style={{ width: COL.status }}>
                        <StatusBadge status={ticket.status as "open" | "in-progress" | "resolved"} />
                      </View>
                      <View style={{ width: COL.sla }}>
                        {(() => {
                          const sla = slaLabel(ticket.slaDueAt);
                          return <Text style={[s.cellDate, { color: sla.color }]}>{ticket.status === "resolved" ? "Met" : sla.text}</Text>;
                        })()}
                      </View>
                      <View style={{ width: COL.date, flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Text style={s.cellDate}>{formatDate(ticket.createdAt)}</Text>
                        <Feather name="chevron-right" size={11} color={colors.border} />
                      </View>
                    </TouchableOpacity>
                  ))
                )}
                 </View>
               </ScrollView>
             </View>
           )}

          {!isLoading && filtered.length > 0 && (
            <Text style={s.resultCount}>{filtered.length} of {allTickets.length} tickets</Text>
          )}
        </Animated.View>
      </ScrollView>

      <BottomNav
        tabs={ADMIN_TABS}
        activeKey="dashboard"
        onPress={(key) => {
          if (key === "analytics")  router.navigate("/(admin)/analytics" as never);
          if (key === "user-stats") router.navigate("/(admin)/user-stats" as never);
          if (key === "access")     router.navigate("/(admin)/access" as never);
          if (key === "audit-log")  router.navigate("/(admin)/audit-log" as never);
        }}
      />
    </View>
  );
}

function StatCard({ label, value, valueColor, accentColor, isDark }: {
  label: string; value: number; valueColor: string; accentColor: string; isDark: boolean;
}) {
  return (
    <View style={[statS.card, {
      borderTopColor: accentColor,
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderColor: isDark ? "#334155" : "#E2E8F0",
    }]}>
      <AnimatedCounter
        value={value}
        color={valueColor}
        style={{ fontSize: 20, fontWeight: "700", fontFamily: "Inter_700Bold" }}
      />
      <Text style={[statS.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>{label}</Text>
    </View>
  );
}
const statS = StyleSheet.create({
  card: { flex: 1, borderRadius: 10, borderWidth: 1, borderTopWidth: 2, padding: 12, alignItems: "center" },
  label: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    statsRow: { flexDirection: "row", padding: 16, gap: 8, paddingBottom: 10 },
    searchWrapper: {
      marginHorizontal: 16, marginBottom: 10,
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 13,
    },
    searchFocused: { borderColor: colors.primary, borderWidth: 2 },
    searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    filterScroll: { marginBottom: 12 },
    filterContent: { paddingHorizontal: 16, gap: 8, flexDirection: "row" },
    filterChip: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    filterChipTextActive: { color: "#FFFFFF" },
    tableCard: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
    tableHeader: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 10, paddingHorizontal: 12,
      backgroundColor: colors.secondary, borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    tableRow: {
      flexDirection: "row", alignItems: "center",
      paddingVertical: 13, paddingHorizontal: 12,
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    cellId: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    cellPrimary: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, lineHeight: 18 },
    cellSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 15 },
    cellDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    tableEmpty: { paddingVertical: 40, alignItems: "center", gap: 12 },
    tableEmptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, marginTop: 4, backgroundColor: colors.primary },
    retryText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
    resultCount: { textAlign: "center", fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 12, marginBottom: 8 },
    workspace: {
      height: 590,
      minHeight: 590,
      flexDirection: "row",
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 13,
      overflow: "hidden",
      backgroundColor: colors.card,
    },
    queuePane: { width: "42%", minWidth: 330, borderRightWidth: 1, borderRightColor: colors.border },
    queueHeader: {
      minHeight: 66,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? "rgba(36,52,71,0.64)" : "rgba(248,250,252,0.8)",
    },
    queueTitle: { color: colors.foreground, fontSize: 14, fontFamily: "Inter_700Bold" },
    queueSubtitle: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
    sortBar: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
    sortLabel: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium", marginRight: 1 },
    sortButton: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5 },
    sortButtonActive: { backgroundColor: isDark ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.08)" },
    sortButtonText: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" },
    sortButtonTextActive: { color: colors.primary, fontFamily: "Inter_700Bold" },
    desktopQueueScroll: { flex: 1 },
    queueRow: {
      minHeight: 104,
      paddingHorizontal: 15,
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      position: "relative",
    },
    queueRowSelected: {
      backgroundColor: isDark ? "rgba(99,102,241,0.14)" : "rgba(99,102,241,0.08)",
      borderLeftWidth: 3,
      borderLeftColor: colors.primary,
      paddingLeft: 12,
    },
    queueRowTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    queueDate: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" },
    queueSubject: { color: colors.foreground, fontSize: 13, fontFamily: "Inter_700Bold", marginTop: 9, paddingRight: 68 },
    queueRowBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 7, paddingRight: 68 },
    queueUser: { color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
    queueSla: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
    queueStatus: { position: "absolute", right: 14, bottom: 13 },
    previewPane: { flex: 1, minWidth: 0 },
  });
}
