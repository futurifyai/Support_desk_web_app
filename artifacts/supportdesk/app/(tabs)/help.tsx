import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  LayoutAnimation,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  useGetHelpArticles,
  type HelpArticle,
  HelpArticleCategory,
  GetHelpArticlesCategory,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav, { NavTab } from "@/components/BottomNav";

const USER_TABS: NavTab[] = [
  { key: "index",   label: "New Ticket", icon: "plus-circle", iconActive: "plus-circle" },
  { key: "history", label: "My Tickets", icon: "list",        iconActive: "list"        },
  { key: "satisfaction", label: "Satisfaction", icon: "star", iconActive: "star" },
];

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug",
  feature: "Feature",
  billing: "Billing",
  account: "Account",
  other: "Other",
  general: "General",
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  bug: "alert-circle",
  feature: "star",
  billing: "credit-card",
  account: "user",
  other: "help-circle",
  general: "book-open",
};

type CategoryFilter = "all" | keyof typeof GetHelpArticlesCategory;

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bug", label: "Bugs" },
  { key: "feature", label: "Features" },
  { key: "billing", label: "Billing" },
  { key: "account", label: "Account" },
  { key: "other", label: "Other" },
];

function ArticleItem({
  article,
  colors,
  isDark,
}: {
  article: HelpArticle;
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const s = makeStyles(colors, isDark);

  function toggle() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  }

  const icon = CATEGORY_ICONS[article.category] ?? "help-circle";

  return (
    <TouchableOpacity
      style={s.articleCard}
      onPress={toggle}
      activeOpacity={0.8}
    >
      <View style={s.articleHeader}>
        <View style={s.articleIconWrap}>
          <Feather name={icon} size={13} color={colors.primary} />
        </View>
        <Text style={s.articleTitle} numberOfLines={expanded ? undefined : 2}>{article.title}</Text>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </View>
      {expanded && (
        <View style={s.articleBody}>
          <Text style={s.articleBodyText}>{article.body}</Text>
          {article.tags ? (
            <View style={s.tagsRow}>
              {article.tags.split(",").map((tag) => tag.trim()).filter(Boolean).map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text style={s.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={s.articleMeta}>
            {CATEGORY_LABELS[article.category] ?? article.category}
            {" · "}
            Updated {new Date(article.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [focused, setFocused] = useState(false);

  const params = {
    ...(debouncedQuery ? { search: debouncedQuery } : {}),
    ...(category !== "all" ? { category: GetHelpArticlesCategory[category as keyof typeof GetHelpArticlesCategory] } : {}),
  };

  const { data, isLoading, isError, refetch } = useGetHelpArticles(
    Object.keys(params).length > 0 ? params : undefined
  );

  const articles = data?.data ?? [];

  const handleQueryChange = useCallback((text: string) => {
    setQuery(text);
    if (debounceTimer) clearTimeout(debounceTimer);
    const timer = setTimeout(() => setDebouncedQuery(text), 350);
    setDebounceTimer(timer);
  }, [debounceTimer]);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={[s.header, BLUR]}>
        <View>
          <Text style={s.headerTitle}>Help Center</Text>
          <Text style={s.headerSub}>Browse articles & FAQs</Text>
        </View>
        <View style={s.headerActions}>
          <ThemeToggle size={36} />
          <TouchableOpacity style={s.iconBtn} onPress={() => router.navigate("/(tabs)/profile" as never)}>
            <Feather name="user" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
      >
        {/* Sticky search + filters */}
        <View style={[s.searchSection, { backgroundColor: colors.background }]}>
          <View style={[s.searchBox, focused && s.searchBoxFocused]}>
            <Feather name="search" size={15} color={colors.mutedForeground} />
            <TextInput
              style={s.searchInput}
              placeholder="Search help articles…"
              placeholderTextColor={colors.mutedForeground}
              value={query}
              onChangeText={handleQueryChange}
              returnKeyType="search"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && Platform.OS !== "ios" && (
              <TouchableOpacity onPress={() => { setQuery(""); setDebouncedQuery(""); }}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.categoryScroll}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.key}
                style={[s.catBtn, category === cat.key && s.catBtnActive]}
                onPress={() => setCategory(cat.key)}
                activeOpacity={0.7}
              >
                <Text style={[s.catText, category === cat.key && s.catTextActive]}>{cat.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Results */}
        {isLoading ? (
          <View style={s.centerBox}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={s.loadingText}>Loading articles…</Text>
          </View>
        ) : isError ? (
          <View style={s.centerBox}>
            <Feather name="alert-circle" size={36} color={colors.destructive} style={{ opacity: 0.6 }} />
            <Text style={s.emptyTitle}>Failed to load articles</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : articles.length === 0 ? (
          <View style={s.centerBox}>
            <Feather name="book-open" size={44} color={colors.border} />
            <Text style={s.emptyTitle}>
              {debouncedQuery || category !== "all" ? "No articles found" : "No articles yet"}
            </Text>
            <Text style={s.emptySub}>
              {debouncedQuery
                ? `No results for "${debouncedQuery}". Try different keywords.`
                : category !== "all"
                ? `No articles in the ${CATEGORY_LABELS[category]} category yet.`
                : "Help articles will appear here once published."}
            </Text>
            {(debouncedQuery || category !== "all") && (
              <TouchableOpacity style={s.retryBtn} onPress={() => { setQuery(""); setDebouncedQuery(""); setCategory("all"); }}>
                <Text style={s.retryText}>Clear filters</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={s.articlesList}>
            <Text style={s.resultsCount}>{articles.length} article{articles.length !== 1 ? "s" : ""}</Text>
            {articles.map((article) => (
              <ArticleItem key={article.id} article={article} colors={colors} isDark={isDark} />
            ))}
          </View>
        )}

        {/* Bottom CTA */}
        <View style={s.ctaCard}>
          <Feather name="message-circle" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={s.ctaTitle}>Can't find what you need?</Text>
            <Text style={s.ctaSub}>Submit a support ticket and our team will help you.</Text>
          </View>
          <TouchableOpacity
            style={s.ctaBtn}
            onPress={() => router.navigate("/(tabs)/" as never)}
            activeOpacity={0.85}
          >
            <Text style={s.ctaBtnText}>New Ticket</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <BottomNav
        tabs={USER_TABS}
        activeKey=""
        onPress={(key) => {
          if (key === "index") router.navigate("/(tabs)/" as never);
          else if (key === "history") router.navigate("/(tabs)/history" as never);
          else if (key === "satisfaction") router.navigate("/(tabs)/satisfaction" as never);
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 15,
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(248,250,252,0.95)",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 19, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: colors.secondary,
      borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
    },
    scroll: { flex: 1 },
    scrollContent: { gap: 14 },
    searchSection: {
      paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, gap: 10,
    },
    searchBox: {
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10,
      paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 13 : 10,
    },
    searchBoxFocused: { borderColor: colors.primary, borderWidth: 2 },
    searchInput: {
      flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground,
      padding: 0,
    },
    categoryScroll: { gap: 8, paddingVertical: 2 },
    catBtn: {
      paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    catBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    catTextActive: { color: "#FFFFFF" },
    centerBox: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
    loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    emptyTitle: { fontSize: 16, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, marginTop: 8 },
    emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
    retryBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: colors.primary },
    retryText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    articlesList: { paddingHorizontal: 16, gap: 8 },
    resultsCount: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground, marginBottom: 4 },
    articleCard: {
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 16,
    },
    articleHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    articleIconWrap: {
      width: 28, height: 28, borderRadius: 8,
      backgroundColor: `rgba(99,102,241,${isDark ? "0.2" : "0.1"})`,
      alignItems: "center", justifyContent: "center", flexShrink: 0,
    },
    articleTitle: { flex: 1, fontSize: 14, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.foreground, lineHeight: 20 },
    articleBody: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
    articleBodyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 22 },
    tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    tag: {
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 6, backgroundColor: colors.secondary,
    },
    tagText: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    articleMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    ctaCard: {
      flexDirection: "row", alignItems: "center", gap: 12,
      marginHorizontal: 16,
      backgroundColor: `rgba(99,102,241,${isDark ? "0.1" : "0.07"})`,
      borderWidth: 1, borderColor: `rgba(99,102,241,${isDark ? "0.25" : "0.18"})`,
      borderRadius: 12, padding: 16,
    },
    ctaTitle: { fontSize: 14, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    ctaSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    ctaBtn: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.primary,
    },
    ctaBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  });
}
