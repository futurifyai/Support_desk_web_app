import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, usePathname } from "expo-router";
import { useGetAdminUserTicketStats, useGetAdminAgents } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import StatusBadge from "@/components/StatusBadge";
import AdminHeader, { AdminHeaderIconButton } from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard",  label: "Tickets",   icon: "grid",        iconActive: "grid"        },
  { key: "analytics",  label: "Analytics", icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users",     icon: "users",       iconActive: "users"       },
  { key: "access",     label: "Access",    icon: "key",         iconActive: "key"         },
  { key: "audit-log",  label: "Audit",     icon: "shield",      iconActive: "shield"      },
];

type SortMode = "tickets" | "recent" | "name";

function formatDateTime(iso: string): string {
  if (!iso) return "—";
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

function formatDateShort(iso: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "#6366F1", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#3B82F6", "#EF4444", "#14B8A6",
];
function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

interface TicketSummary {
  id: string;
  productName: string;
  status: string;
  createdAt: string;
}
interface UserStat {
  userId: string;
  userName: string;
  userEmail: string;
  ticketCount: number;
  firstTicketAt: string;
  lastTicketAt: string;
  tickets: TicketSummary[];
}

function UserRow({ stat, index, colors, isDark }: {
  stat: UserStat;
  index: number;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    const delay = Math.min(index * 60, 450);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
  }, []);

  function toggleExpand() {
    const toValue = expanded ? 0 : 1;
    Animated.spring(expandAnim, { toValue, friction: 8, tension: 60, useNativeDriver: false }).start();
    setExpanded(!expanded);
  }

  const chevronRotate = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });

  const bg = avatarColor(stat.userId);
  const openCount = stat.tickets.filter((t) => t.status === "open").length;
  const resolvedCount = stat.tickets.filter((t) => t.status === "resolved").length;
  const inProgressCount = stat.tickets.filter((t) => t.status === "in-progress").length;

  const s = makeRowStyles(colors, isDark);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity onPress={toggleExpand} activeOpacity={0.75} style={s.cardHeader}>
        <View style={[s.avatar, { backgroundColor: bg }]}>
          <Text style={s.avatarText}>{getInitials(stat.userName)}</Text>
        </View>

        <View style={s.userInfo}>
          <View style={s.nameRow}>
            <Text style={s.userName} numberOfLines={1}>{stat.userName}</Text>
            <View style={[s.countBadge, { backgroundColor: `${bg}22`, borderColor: `${bg}55` }]}>
              <Text style={[s.countBadgeText, { color: bg }]}>{stat.ticketCount}</Text>
            </View>
          </View>
          <Text style={s.userEmail} numberOfLines={1}>{stat.userEmail}</Text>
          <Text style={s.lastSeen}>
            Last: {formatDateShort(stat.lastTicketAt)}
          </Text>
        </View>

        <Animated.View style={{ transform: [{ rotate: chevronRotate }], marginLeft: 4 }}>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </Animated.View>
      </TouchableOpacity>

      <View style={s.miniStats}>
        <MiniStat label="Open" count={openCount} color="#A5B4FC" bg="rgba(99,102,241,0.12)" />
        <MiniStat label="In Progress" count={inProgressCount} color="#FCD34D" bg="rgba(245,158,11,0.12)" />
        <MiniStat label="Resolved" count={resolvedCount} color="#4ADE80" bg="rgba(34,197,94,0.12)" />
        <View style={s.firstSeen}>
          <Feather name="calendar" size={10} color={colors.mutedForeground} />
          <Text style={s.firstSeenText}>First: {formatDateShort(stat.firstTicketAt)}</Text>
        </View>
      </View>

      {expanded && (
        <View style={s.ticketList}>
          <View style={s.divider} />
          <View style={s.ticketListHeader}>
            <Feather name="list" size={12} color={colors.mutedForeground} />
            <Text style={s.ticketListTitle}>Ticket History ({stat.tickets.length})</Text>
          </View>
          {stat.tickets.map((ticket, ti) => (
            <View key={ticket.id} style={[s.ticketRow, ti < stat.tickets.length - 1 && s.ticketRowBorder]}>
              <View style={s.ticketLeft}>
                <View style={s.ticketTopRow}>
                  <Text style={s.ticketProduct} numberOfLines={1}>{ticket.productName}</Text>
                  <StatusBadge status={ticket.status as "open" | "in-progress" | "resolved"} />
                </View>
                <View style={s.ticketDateRow}>
                  <Feather name="clock" size={10} color={colors.mutedForeground} />
                  <Text style={s.ticketDate}>{formatDateTime(ticket.createdAt)}</Text>
                </View>
                <Text style={s.ticketId}>#{ticket.id.slice(-8)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

function MiniStat({ label, count, color, bg }: { label: string; count: number; color: string; bg: string }) {
  return (
    <View style={[miniS.pill, { backgroundColor: bg }]}>
      <Text style={[miniS.count, { color }]}>{count}</Text>
      <Text style={[miniS.label, { color }]}>{label}</Text>
    </View>
  );
}
const miniS = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  count: { fontSize: 12, fontFamily: "Inter_700Bold", fontWeight: "700" as const },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

export default function UserStatsScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("tickets");

  const { data, isLoading, isRefetching, refetch, isError } = useGetAdminUserTicketStats();
  const { data: agentsData } = useGetAdminAgents();
  const rawStats = (data?.data ?? []) as UserStat[];
  const agents = (agentsData?.data ?? []) as Array<{ id: string; name: string; email: string; openTicketCount?: number; averageRating?: number | null }>;

  const filtered = React.useMemo(() => {
    let list = [...rawStats];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (u) => u.userName.toLowerCase().includes(q) || u.userEmail.toLowerCase().includes(q)
      );
    }
    if (sortMode === "tickets") list.sort((a, b) => b.ticketCount - a.ticketCount);
    else if (sortMode === "recent") list.sort((a, b) => new Date(b.lastTicketAt).getTime() - new Date(a.lastTicketAt).getTime());
    else list.sort((a, b) => a.userName.localeCompare(b.userName));
    return list;
  }, [rawStats, search, sortMode]);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const totalTickets = rawStats.reduce((sum, user) => sum + user.ticketCount, 0);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="User Activity"
        subtitle={`${rawStats.length} user${rawStats.length !== 1 ? "s" : ""} · ${totalTickets} total ticket${totalTickets !== 1 ? "s" : ""}`}
        rightActions={
          <AdminHeaderIconButton
            icon="refresh-cw"
            accessibilityLabel="Refresh user activity"
            onPress={() => void refetch()}
            disabled={isRefetching}
            loading={isRefetching}
          />
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 110 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {agents.length > 0 && (
          <View style={s.agentSummary}>
            <Text style={s.agentSummaryTitle}>Agent performance</Text>
            {agents.map((agent) => (
              <View key={agent.id} style={s.agentSummaryRow}>
                <View style={s.agentSummaryAvatar}><Text style={s.agentSummaryInitial}>{agent.name[0]?.toUpperCase()}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.agentSummaryName}>{agent.name}</Text>
                  <Text style={s.agentSummaryMeta}>{agent.openTicketCount ?? 0} open ticket{(agent.openTicketCount ?? 0) === 1 ? "" : "s"}</Text>
                </View>
                <View style={s.ratingPill}>
                  <Feather name="star" size={12} color="#F59E0B" />
                  <Text style={s.ratingPillText}>{agent.averageRating?.toFixed(1) ?? "—"}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        <View style={[s.searchWrapper, searchFocused && s.searchFocused]}>
          <Feather name="search" size={15} color={searchFocused ? colors.primary : colors.mutedForeground} />
          <TextInput
            style={s.searchInput}
            placeholder="Search by name or email…"
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

        <View style={s.sortRow}>
          <Text style={s.sortLabel}>Sort by:</Text>
          {([
            { key: "tickets", icon: "bar-chart-2", label: "Most tickets" },
            { key: "recent",  icon: "clock",       label: "Most recent" },
            { key: "name",    icon: "user",         label: "Name" },
          ] as const).map(({ key, icon, label }) => (
            <TouchableOpacity
              key={key}
              style={[s.sortBtn, sortMode === key && s.sortBtnActive]}
              onPress={() => setSortMode(key)}
              activeOpacity={0.7}
            >
              <Feather name={icon} size={12} color={sortMode === key ? "#fff" : colors.mutedForeground} />
              <Text style={[s.sortBtnText, sortMode === key && s.sortBtnTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {isLoading ? (
          <View style={s.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.centerText}>Loading user activity…</Text>
          </View>
        ) : isError ? (
          <View style={s.centerState}>
            <Feather name="alert-circle" size={40} color={colors.destructive} style={{ opacity: 0.5 }} />
            <Text style={s.centerText}>Failed to load data</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : filtered.length === 0 ? (
          <View style={s.centerState}>
            <Feather name="users" size={40} color={colors.border} />
            <Text style={s.centerText}>{search ? "No users match your search" : "No user activity yet"}</Text>
          </View>
        ) : (
          <>
            <Text style={s.resultCount}>{filtered.length} user{filtered.length !== 1 ? "s" : ""} · tap a card to see tickets</Text>
            {filtered.map((stat, i) => (
              <UserRow key={stat.userId} stat={stat} index={i} colors={colors} isDark={isDark} />
            ))}
          </>
        )}
      </ScrollView>

      <BottomNav
        tabs={ADMIN_TABS}
        activeKey="user-stats"
        onPress={(key) => {
          if (key === "dashboard") router.navigate("/(admin)/dashboard" as never);
          if (key === "analytics") router.navigate("/(admin)/analytics" as never);
          if (key === "access") router.navigate("/(admin)/access" as never);
          if (key === "audit-log") router.navigate("/(admin)/audit-log" as never);
        }}
      />
    </View>
  );
}

function makeRowStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
      marginBottom: 10, overflow: "hidden",
      ...(isDark ? {} : { shadowColor: "#6366F1", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 }),
    },
    cardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
    avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    avatarText: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
    userInfo: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
    userName: { fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    countBadge: {
      borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0,
    },
    countBadgeText: { fontSize: 13, fontWeight: "700" as const, fontFamily: "Inter_700Bold" },
    userEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 2 },
    lastSeen: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.muted },
    miniStats: {
      flexDirection: "row", flexWrap: "wrap", alignItems: "center",
      paddingHorizontal: 14, paddingBottom: 12, gap: 6,
    },
    firstSeen: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" as unknown as number },
    firstSeenText: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 14, marginBottom: 12 },
    ticketList: { paddingHorizontal: 14, paddingBottom: 8 },
    ticketListHeader: {
      flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10,
    },
    ticketListTitle: {
      fontSize: 12, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5,
    },
    ticketRow: { paddingVertical: 10 },
    ticketRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    ticketLeft: { flex: 1 },
    ticketTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 5 },
    ticketProduct: { fontSize: 14, fontWeight: "500" as const, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    ticketDateRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
    ticketDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    ticketId: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.muted },
  });
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    agentSummary: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, gap: 10, marginBottom: 14 },
    agentSummaryTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, letterSpacing: 0.7, textTransform: "uppercase" },
    agentSummaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    agentSummaryAvatar: { width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(99,102,241,0.16)", alignItems: "center", justifyContent: "center" },
    agentSummaryInitial: { color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 13 },
    agentSummaryName: { color: colors.foreground, fontFamily: "Inter_600SemiBold", fontSize: 13 },
    agentSummaryMeta: { color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 1 },
    ratingPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
    ratingPillText: { color: "#F59E0B", fontFamily: "Inter_700Bold", fontSize: 12 },
    searchWrapper: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 13, marginBottom: 12,
    },
    searchFocused: { borderColor: colors.primary, borderWidth: 2 },
    searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    sortRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 14, flexWrap: "wrap" },
    sortLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginRight: 2 },
    sortBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    sortBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    sortBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    sortBtnTextActive: { color: "#FFFFFF" },
    resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 10, textAlign: "center" },
    centerState: { paddingTop: 80, alignItems: "center", gap: 12 },
    centerText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary, marginTop: 4 },
    retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  });
}
