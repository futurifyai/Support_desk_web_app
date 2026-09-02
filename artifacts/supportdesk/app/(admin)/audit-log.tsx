import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetAuditLogs } from "@workspace/api-client-react";
import type { AuditLog } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import AdminHeader, { AdminHeaderIconButton } from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard",  label: "Tickets",   icon: "grid",        iconActive: "grid"        },
  { key: "analytics",  label: "Analytics", icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users",     icon: "users",       iconActive: "users"       },
  { key: "access",     label: "Access",    icon: "key",         iconActive: "key"         },
  { key: "audit-log",  label: "Audit",     icon: "shield",      iconActive: "shield"      },
];

const PAGE_SIZE = 20;

const ACTION_FILTERS = [
  { key: "",                  label: "All"         },
  { key: "ticket_created",    label: "Created"     },
  { key: "ticket_status_update", label: "Status"   },
  { key: "ticket_assigned",   label: "Assigned"    },
  { key: "admin_reply",       label: "Reply"       },
  { key: "login",             label: "Login"       },
  { key: "profile_update",    label: "Profile"     },
];

const ACTION_ICON: Record<string, keyof typeof Feather.glyphMap> = {
  ticket_created: "plus-circle",
  ticket_status_update: "edit-2",
  ticket_assigned: "user-check",
  admin_reply: "message-circle",
  login: "log-in",
  profile_update: "user",
};

const ACTION_COLOR: Record<string, string> = {
  ticket_created: "#6366F1",
  ticket_status_update: "#F59E0B",
  ticket_assigned: "#3B82F6",
  admin_reply: "#22C55E",
  login: "#10B981",
  profile_update: "#F97316",
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return iso; }
}

function getActionIcon(action: string): keyof typeof Feather.glyphMap {
  return ACTION_ICON[action] ?? "activity";
}

function getActionColor(action: string): string {
  return ACTION_COLOR[action] ?? "#6366F1";
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function AuditEventRow({ event, isDark, colors }: {
  event: AuditLog;
  isDark: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const icon = getActionIcon(event.action);
  const color = getActionColor(event.action);

  return (
    <View style={[rowS.row, {
      backgroundColor: colors.card,
      borderColor: colors.border,
      shadowColor: isDark ? "#000000" : "#94A3B8",
    }]}>
      <View style={[rowS.iconBox, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={rowS.topRow}>
          <Text style={[rowS.action, { color: colors.foreground }]} numberOfLines={1}>{formatAction(event.action)}</Text>
          <Text style={[rowS.time, { color: colors.mutedForeground }]}>{formatDateTime(event.createdAt)}</Text>
        </View>
        <View style={rowS.metaRow}>
          {event.actorEmail ? (
            <View style={rowS.actorWrap}>
              <Feather name="user" size={10} color={colors.mutedForeground} />
              <Text style={[rowS.actor, { color: colors.mutedForeground }]} numberOfLines={1}>{event.actorEmail}</Text>
            </View>
          ) : (
            <Text style={[rowS.actor, { color: colors.muted }]}>system</Text>
          )}
          {event.resourceType ? (
            <View style={[rowS.resourcePill, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" }]}>
              <Text style={[rowS.resourceText, { color: colors.mutedForeground }]}>{formatAction(event.resourceType)}</Text>
              {event.resourceId && (
                <Text style={[rowS.resourceId, { color: colors.muted }]}>#{event.resourceId.slice(-6)}</Text>
              )}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
const rowS = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 13, borderRadius: 14, borderWidth: 1, marginBottom: 9,
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  iconBox: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  action: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 0 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  actorWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  actor: { fontSize: 11, fontFamily: "Inter_400Regular", flexShrink: 1 },
  resourcePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
  resourceText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  resourceId: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

export default function AuditLogScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const queryParams = {
    page,
    pageSize: PAGE_SIZE,
    ...(actionFilter ? { action: actionFilter } : {}),
  };

  const { data, isLoading, isRefetching, refetch, isError } = useGetAuditLogs(queryParams);
  const events: AuditLog[] = (data?.data ?? []) as AuditLog[];
  const visibleEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) =>
      [event.action, event.actorEmail, event.resourceType, event.resourceId]
        .some((value) => value?.toLowerCase().includes(term)),
    );
  }, [events, search]);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleFilterChange(key: string) {
    setActionFilter(key);
    setPage(1);
  }

  function handlePrevPage() {
    if (page > 1) setPage((p) => p - 1);
  }

  function handleNextPage() {
    if (events.length >= PAGE_SIZE) setPage((p) => p + 1);
  }

  const hasNext = events.length >= PAGE_SIZE;
  const hasPrev = page > 1;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="Audit Log"
        subtitle="Review activity across your workspace"
        rightActions={
          <AdminHeaderIconButton
            icon="refresh-cw"
            accessibilityLabel="Refresh audit log"
            onPress={() => { setPage(1); void refetch(); }}
            disabled={isRefetching}
            loading={isRefetching}
          />
        }
      />

      <View style={s.controls}>
        <View style={[s.searchBox, searchFocused && s.searchBoxFocused]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search activity"
            placeholderTextColor={colors.mutedForeground}
            style={[s.searchInput, { color: colors.foreground }]}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
              <Feather name="x-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={s.filterHeading}>
          <Text style={s.filterTitle}>Filter by action</Text>
          <Text style={s.filterHint}>{visibleEvents.length} shown</Text>
        </View>
      </View>

      <View style={s.filterGrid}>
        {ACTION_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[s.filterChip, actionFilter === f.key && s.filterChipActive]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Text style={[s.filterChipText, actionFilter === f.key && s.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { setPage(1); refetch(); }}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 120 }]}
      >
        {isLoading ? (
          <View style={s.centerState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.centerText}>Loading audit log…</Text>
          </View>
        ) : isError ? (
          <View style={s.centerState}>
            <Feather name="alert-circle" size={44} color={colors.destructive} style={{ opacity: 0.5 }} />
            <Text style={s.centerText}>Failed to load audit log</Text>
            <Text style={[s.centerSub, { color: colors.mutedForeground }]}>
              Check your connection or permissions and try again.
            </Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : events.length === 0 || visibleEvents.length === 0 ? (
          <View style={s.centerState}>
            <Feather name="inbox" size={44} color={colors.border} />
            <Text style={s.centerText}>{search ? "No matching activity" : "No audit events found"}</Text>
            <Text style={[s.centerSub, { color: colors.mutedForeground }]}>
              {search
                ? `Nothing on this page matches "${search}".`
                : actionFilter
                ? `No events matching "${actionFilter}" on this page.`
                : "No audit events recorded yet."}
            </Text>
            {actionFilter || search ? (
              <TouchableOpacity
                style={s.clearFilterBtn}
                onPress={() => { setSearch(""); handleFilterChange(""); }}
              >
                <Text style={[s.clearFilterText, { color: colors.primary }]}>Clear filters</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            <Text style={[s.resultLabel, { color: colors.mutedForeground }]}>
              Page {page} · {visibleEvents.length} event{visibleEvents.length !== 1 ? "s" : ""}
              {actionFilter ? ` · filter: ${actionFilter}` : ""}
            </Text>
            {visibleEvents.map((event) => (
              <AuditEventRow key={event.id} event={event} isDark={isDark} colors={colors} />
            ))}

            {/* Pagination controls */}
            <View style={s.paginationRow}>
              <TouchableOpacity
                style={[s.pageBtn, !hasPrev && s.pageBtnDisabled]}
                onPress={handlePrevPage}
                disabled={!hasPrev}
              >
                <Feather name="chevron-left" size={16} color={hasPrev ? colors.primary : colors.muted} />
                <Text style={[s.pageBtnText, { color: hasPrev ? colors.primary : colors.muted }]}>Prev</Text>
              </TouchableOpacity>
              <View style={s.pageIndicator}>
                <Text style={[s.pageIndicatorText, { color: colors.foreground }]}>{page}</Text>
              </View>
              <TouchableOpacity
                style={[s.pageBtn, !hasNext && s.pageBtnDisabled]}
                onPress={handleNextPage}
                disabled={!hasNext}
              >
                <Text style={[s.pageBtnText, { color: hasNext ? colors.primary : colors.muted }]}>Next</Text>
                <Feather name="chevron-right" size={16} color={hasNext ? colors.primary : colors.muted} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav
        tabs={ADMIN_TABS}
        activeKey="audit-log"
        onPress={(key) => {
          if (key === "dashboard")  router.navigate("/(admin)/dashboard" as never);
          if (key === "analytics")  router.navigate("/(admin)/analytics" as never);
          if (key === "user-stats") router.navigate("/(admin)/user-stats" as never);
          if (key === "access") router.navigate("/(admin)/access" as never);
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    controls: { paddingTop: 14, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    searchBox: {
      marginHorizontal: 16, height: 44, flexDirection: "row", alignItems: "center", gap: 10,
      paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      backgroundColor: colors.card,
    },
    searchBoxFocused: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
    searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontSize: 13, fontFamily: "Inter_400Regular" },
    filterHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 13, paddingBottom: 1 },
    filterTitle: { fontSize: 11, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: 0.4 },
    filterHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    filterGrid: {
      flexDirection: "row", flexWrap: "wrap", gap: 8,
      paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12,
    },
    filterChip: {
      paddingHorizontal: 13, paddingVertical: 7, borderRadius: 9,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
      alignSelf: "flex-start",
    },
    filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    filterChipTextActive: { color: "#FFFFFF" },
    scroll: { flex: 1 },
    scrollContent: { padding: 16 },
    resultLabel: {
      fontSize: 11, fontFamily: "Inter_400Regular",
      marginBottom: 12, textAlign: "center",
    },
    centerState: { paddingTop: 80, alignItems: "center", gap: 12 },
    centerText: { fontSize: 16, fontFamily: "Inter_500Medium", color: colors.foreground, textAlign: "center" },
    centerSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", maxWidth: 280, lineHeight: 20 },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.primary, marginTop: 4 },
    retryText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    clearFilterBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.primary, marginTop: 4 },
    clearFilterText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    paginationRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: 16, paddingVertical: 16,
    },
    pageBtn: {
      flexDirection: "row", alignItems: "center", gap: 4,
      paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    pageBtnDisabled: { opacity: 0.4 },
    pageBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
    pageIndicator: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    pageIndicatorText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#fff" },
  });
}
