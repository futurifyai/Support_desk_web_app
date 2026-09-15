import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useGetTickets,
  type GetTicketsParams,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import TicketCard from "@/components/TicketCard";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav, { NavTab } from "@/components/BottomNav";

const USER_TABS: NavTab[] = [
  { key: "index", label: "New Ticket", icon: "plus-circle", iconActive: "plus-circle" },
  { key: "history", label: "My Tickets", icon: "list", iconActive: "list" },
  { key: "satisfaction", label: "Satisfaction", icon: "star", iconActive: "star" },
];

type TicketFilters = {
  search: string;
  status: "all" | TicketStatus;
  priority: "all" | TicketPriority;
  category: "all" | TicketCategory;
  startDate: string;
  endDate: string;
};

type SavedFilter = { id: string; name: string; filters: TicketFilters };

const EMPTY_FILTERS: TicketFilters = {
  search: "", status: "all", priority: "all", category: "all", startDate: "", endDate: "",
};

const STATUSES: { key: TicketFilters["status"]; label: string }[] = [
  { key: "all", label: "All" }, { key: "open", label: "Open" },
  { key: "in-progress", label: "In progress" }, { key: "resolved", label: "Resolved" },
];
const PRIORITIES: { key: TicketFilters["priority"]; label: string }[] = [
  { key: "all", label: "Any" }, { key: "critical", label: "Critical" },
  { key: "high", label: "High" }, { key: "medium", label: "Medium" }, { key: "low", label: "Low" },
];
const CATEGORIES: { key: TicketFilters["category"]; label: string }[] = [
  { key: "all", label: "Any" }, { key: "bug", label: "Bug" }, { key: "feature", label: "Feature" },
  { key: "billing", label: "Billing" }, { key: "account", label: "Account" }, { key: "other", label: "Other" },
];

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeFilters(value: unknown): TicketFilters | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<Record<keyof TicketFilters, unknown>>;
  const status = STATUSES.some((item) => item.key === candidate.status) ? candidate.status as TicketFilters["status"] : "all";
  const priority = PRIORITIES.some((item) => item.key === candidate.priority) ? candidate.priority as TicketFilters["priority"] : "all";
  const category = CATEGORIES.some((item) => item.key === candidate.category) ? candidate.category as TicketFilters["category"] : "all";
  const startDate = typeof candidate.startDate === "string" && isValidDate(candidate.startDate) ? candidate.startDate : "";
  const endDate = typeof candidate.endDate === "string" && isValidDate(candidate.endDate) ? candidate.endDate : "";
  return {
    search: typeof candidate.search === "string" ? candidate.search.slice(0, 120) : "",
    status,
    priority,
    category,
    startDate: startDate && endDate && startDate > endDate ? "" : startDate,
    endDate: startDate && endDate && startDate > endDate ? "" : endDate,
  };
}

function FilterChips<T extends string>({
  items, value, onChange, styles,
}: {
  items: { key: T; label: string }[]; value: T; onChange: (value: T) => void; styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {items.map((item) => (
        <TouchableOpacity key={item.key} style={[styles.chip, value === item.key && styles.chipActive]} onPress={() => onChange(item.key)} activeOpacity={0.8}>
          <Text style={[styles.chipText, value === item.key && styles.chipTextActive]}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [filters, setFilters] = useState<TicketFilters>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState("");
  const [page, setPage] = useState(1);
  const storageKey = `supportdesk.ticket-filters.${user?.id ?? "anonymous"}`;

  useEffect(() => {
    let active = true;
    setSavedFilters([]);
    setPresetError("");
    void AsyncStorage.getItem(storageKey).then((stored) => {
      if (!active || !stored) return;
      try {
        const parsed = JSON.parse(stored) as unknown;
        if (Array.isArray(parsed)) {
          const restored = parsed.flatMap((item): SavedFilter[] => {
            if (!item || typeof item !== "object") return [];
            const candidate = item as Partial<SavedFilter>;
            const filters = normalizeFilters(candidate.filters);
            if (!filters || typeof candidate.id !== "string" || typeof candidate.name !== "string" || candidate.name.trim().length < 2) return [];
            return [{ id: candidate.id, name: candidate.name.slice(0, 32), filters }];
          });
          setSavedFilters(restored);
        }
      } catch {
        void AsyncStorage.removeItem(storageKey);
      }
    });
    return () => { active = false; };
  }, [storageKey]);

  useEffect(() => {
    setPage(1);
  }, [filters.search, filters.status, filters.priority, filters.category, filters.startDate, filters.endDate]);

  const params = useMemo<GetTicketsParams>(() => ({
    ...(filters.search.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.priority !== "all" ? { priority: filters.priority } : {}),
    ...(filters.category !== "all" ? { category: filters.category } : {}),
    ...(isValidDate(filters.startDate) ? { startDate: filters.startDate } : {}),
    ...(isValidDate(filters.endDate) ? { endDate: filters.endDate } : {}),
    page,
    pageSize: 100,
  }), [filters, page]);
  const { data, isLoading, isRefetching, isError, refetch } = useGetTickets(params);
  const tickets = data?.data ?? [];
  const total = data?.meta.total ?? tickets.length;
  const totalPages = data?.meta.totalPages ?? 1;
  const activeFilterCount = [
    filters.status !== "all", filters.priority !== "all", filters.category !== "all",
    Boolean(filters.startDate), Boolean(filters.endDate),
  ].filter(Boolean).length;
  const invalidDate = (filters.startDate && !isValidDate(filters.startDate)) || (filters.endDate && !isValidDate(filters.endDate));
  const reversedDate = isValidDate(filters.startDate) && isValidDate(filters.endDate) && filters.startDate > filters.endDate;
  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function updateFilter<K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  async function persist(next: SavedFilter[]) {
    setSavedFilters(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  }

  async function savePreset() {
    const name = presetName.trim();
    setPresetError("");
    if (name.length < 2) {
      setPresetError("Name this view with at least 2 characters.");
      return;
    }
    if (savedFilters.some((preset) => preset.name.toLowerCase() === name.toLowerCase())) {
      setPresetError("A saved view already uses that name.");
      return;
    }
    const next = [...savedFilters, { id: `${Date.now()}-${name}`, name, filters }];
    try {
      await persist(next);
      setPresetName("");
    } catch {
      setPresetError("Could not save this view on your device.");
    }
  }

  async function deletePreset(id: string) {
    try {
      await persist(savedFilters.filter((preset) => preset.id !== id));
    } catch {
      setPresetError("Could not remove that saved view.");
    }
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={[s.header, BLUR]}>
        <View style={s.headerCopy}>
          <Text style={s.headerTitle}>My Tickets</Text>
          <Text style={s.headerSub}>Search and organize your support requests</Text>
        </View>
        <View style={s.headerActions}>
          <ThemeToggle size={36} />
          <TouchableOpacity style={s.iconBtn} onPress={() => refetch()} disabled={isRefetching}>
            {isRefetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={15} color={colors.mutedForeground} />}
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.navigate("/(tabs)/profile" as never)}>
            <Feather name="user" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
      >
        <View style={s.searchRow}>
          <Feather name="search" size={17} color={colors.mutedForeground} />
          <TextInput
            style={s.searchInput}
            value={filters.search}
            onChangeText={(value) => updateFilter("search", value)}
            placeholder="Search tickets, replies, or ticket ID"
            placeholderTextColor={colors.mutedForeground}
            returnKeyType="search"
          />
          {filters.search ? <TouchableOpacity onPress={() => updateFilter("search", "")} hitSlop={8}><Feather name="x-circle" size={16} color={colors.mutedForeground} /></TouchableOpacity> : null}
        </View>

        <View style={s.toolbar}>
          <TouchableOpacity style={[s.filterToggle, showFilters && s.filterToggleActive]} onPress={() => setShowFilters((shown) => !shown)} activeOpacity={0.8}>
            <Feather name="sliders" size={14} color={showFilters ? "#fff" : colors.primary} />
            <Text style={[s.filterToggleText, showFilters && s.filterToggleTextActive]}>Filters{activeFilterCount ? ` · ${activeFilterCount}` : ""}</Text>
          </TouchableOpacity>
          {(activeFilterCount > 0 || filters.search) ? (
            <TouchableOpacity style={s.clearButton} onPress={() => setFilters(EMPTY_FILTERS)}>
              <Text style={s.clearText}>Clear all</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={s.resultText}>{isLoading ? "Loading…" : `${total} result${total === 1 ? "" : "s"}`}</Text>
        </View>

        {showFilters ? (
          <View style={s.filterPanel}>
            <Text style={s.filterLabel}>Status</Text>
            <FilterChips items={STATUSES} value={filters.status} onChange={(value) => updateFilter("status", value)} styles={s} />
            <Text style={s.filterLabel}>Priority</Text>
            <FilterChips items={PRIORITIES} value={filters.priority} onChange={(value) => updateFilter("priority", value)} styles={s} />
            <Text style={s.filterLabel}>Category</Text>
            <FilterChips items={CATEGORIES} value={filters.category} onChange={(value) => updateFilter("category", value)} styles={s} />
            <Text style={s.filterLabel}>Created between</Text>
            <View style={s.dateRow}>
              <TextInput style={s.dateInput} value={filters.startDate} onChangeText={(value) => updateFilter("startDate", value)} placeholder="From YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
              <Text style={s.dateDivider}>—</Text>
              <TextInput style={s.dateInput} value={filters.endDate} onChangeText={(value) => updateFilter("endDate", value)} placeholder="To YYYY-MM-DD" placeholderTextColor={colors.mutedForeground} autoCapitalize="none" />
            </View>
            {invalidDate || reversedDate ? <Text style={s.inlineError}>{reversedDate ? "End date must be on or after the start date." : "Use valid YYYY-MM-DD dates."}</Text> : null}
          </View>
        ) : null}

        <View style={s.savedSection}>
          <View style={s.savedHeading}><Feather name="bookmark" size={14} color={colors.primary} /><Text style={s.savedTitle}>Saved views</Text></View>
          {savedFilters.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.savedChipRow}>
              {savedFilters.map((preset) => (
                <View key={preset.id} style={s.savedChip}>
                  <TouchableOpacity onPress={() => setFilters({ ...EMPTY_FILTERS, ...preset.filters })} activeOpacity={0.8}><Text style={s.savedChipText}>{preset.name}</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => void deletePreset(preset.id)} hitSlop={7}><Feather name="x" size={13} color={colors.mutedForeground} /></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : <Text style={s.savedHint}>Save frequent searches and filter combinations here.</Text>}
          <View style={s.saveRow}>
            <TextInput style={s.presetInput} value={presetName} onChangeText={(value) => { setPresetName(value); setPresetError(""); }} placeholder="Name this view" placeholderTextColor={colors.mutedForeground} maxLength={32} />
            <TouchableOpacity style={s.saveButton} onPress={() => void savePreset()} activeOpacity={0.8}><Feather name="bookmark" size={14} color="#fff" /><Text style={s.saveButtonText}>Save</Text></TouchableOpacity>
          </View>
          {presetError ? <Text style={s.inlineError}>{presetError}</Text> : null}
        </View>

        {isLoading ? <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={s.centerText}>Finding your tickets…</Text></View>
          : isError ? <View style={s.center}><Feather name="alert-circle" size={40} color={colors.destructive} /><Text style={s.centerTitle}>Couldn’t load tickets</Text><TouchableOpacity style={s.retryButton} onPress={() => refetch()}><Text style={s.retryText}>Try again</Text></TouchableOpacity></View>
            : tickets.length ? <View style={s.list}>{tickets.map((ticket, index) => <TicketCard key={ticket.id} ticket={ticket} index={index} />)}</View>
              : <View style={s.center}><Feather name="search" size={42} color={colors.border} /><Text style={s.centerTitle}>No tickets found</Text><Text style={s.centerText}>{filters.search || activeFilterCount ? "Try clearing a filter or searching for different words." : "Submit your first support ticket to get started."}</Text></View>}

        {!isLoading && !isError && totalPages > 1 ? (
          <View style={s.pagination}>
            <TouchableOpacity style={[s.pageButton, page === 1 && s.pageButtonDisabled]} onPress={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>
              <Feather name="chevron-left" size={16} color={page === 1 ? colors.muted : colors.primary} />
              <Text style={[s.pageButtonText, page === 1 && s.pageButtonTextDisabled]}>Previous</Text>
            </TouchableOpacity>
            <Text style={s.pageText}>Page {page} of {totalPages}</Text>
            <TouchableOpacity style={[s.pageButton, page === totalPages && s.pageButtonDisabled]} onPress={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>
              <Text style={[s.pageButtonText, page === totalPages && s.pageButtonTextDisabled]}>Next</Text>
              <Feather name="chevron-right" size={16} color={page === totalPages ? colors.muted : colors.primary} />
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <BottomNav tabs={USER_TABS} activeKey="history" onPress={(key) => {
        if (key === "index") router.navigate("/(tabs)/" as never);
        if (key === "satisfaction") router.navigate("/(tabs)/satisfaction" as never);
      }} />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: isDark ? "rgba(6,14,30,0.95)" : "rgba(248,252,255,0.95)", borderBottomWidth: 1, borderBottomColor: colors.border },
    headerCopy: { flex: 1, minWidth: 0, marginRight: 12 },
    headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { flexShrink: 1, fontSize: 12, lineHeight: 16, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    headerActions: { flexShrink: 0, flexDirection: "row", gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.secondary, borderWidth: 1, borderColor: isDark ? "rgba(255,255,255,0.10)" : colors.border, alignItems: "center", justifyContent: "center" },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 12 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 13, backgroundColor: colors.input },
    searchInput: { flex: 1, minHeight: 46, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    toolbar: { flexDirection: "row", alignItems: "center", gap: 9 },
    filterToggle: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 9, borderWidth: 1, borderColor: colors.primary, backgroundColor: isDark ? "rgba(47,128,237,0.10)" : "rgba(47,128,237,0.06)" },
    filterToggleActive: { backgroundColor: colors.primary },
    filterToggleText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
    filterToggleTextActive: { color: "#fff" },
    clearButton: { paddingVertical: 7 },
    clearText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.destructive },
    resultText: { flex: 1, textAlign: "right", fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    filterPanel: { padding: 14, gap: 8, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    filterLabel: { fontSize: 11, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.5, color: colors.mutedForeground, marginTop: 2 },
    chipRow: { gap: 7, paddingBottom: 4 },
    chip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    chipTextActive: { color: "#fff" },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    dateInput: { flex: 1, height: 42, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground },
    dateDivider: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    inlineError: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.destructive },
    savedSection: { padding: 14, gap: 9, borderRadius: 13, borderWidth: 1, borderColor: isDark ? "rgba(47,128,237,0.25)" : "rgba(47,128,237,0.16)", backgroundColor: isDark ? "rgba(47,128,237,0.08)" : "rgba(47,128,237,0.04)" },
    savedHeading: { flexDirection: "row", alignItems: "center", gap: 6 },
    savedTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground },
    savedHint: { fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    savedChipRow: { gap: 7 },
    savedChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    savedChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    saveRow: { flexDirection: "row", gap: 8 },
    presetInput: { flex: 1, height: 40, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.foreground },
    saveButton: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.primary },
    saveButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
    list: { gap: 10 },
    center: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 28, gap: 9 },
    centerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    centerText: { fontSize: 13, lineHeight: 19, textAlign: "center", fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryButton: { marginTop: 5, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
    retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 4 },
    pageButton: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    pageButtonDisabled: { backgroundColor: colors.secondary },
    pageButtonText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
    pageButtonTextDisabled: { color: colors.muted },
    pageText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
  });
}