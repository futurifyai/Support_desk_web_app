import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetAdminAnalytics, getExportAnalyticsCsvUrl } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import AdminHeader from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard",  label: "Tickets",    icon: "grid",        iconActive: "grid"        },
  { key: "analytics",  label: "Analytics",  icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users",      icon: "users",       iconActive: "users"       },
  { key: "access",     label: "Access",     icon: "key",         iconActive: "key"         },
  { key: "audit-log",  label: "Audit",      icon: "shield",      iconActive: "shield"      },
];

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high:     "#F97316",
  medium:   "#EAB308",
  low:      "#64748B",
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  bug:     "alert-circle",
  feature: "star",
  billing: "credit-card",
  account: "user",
  other:   "help-circle",
};

function HorizBar({ label, value, max, color, icon }: {
  label: string; value: number; max: number; color: string; icon?: keyof typeof Feather.glyphMap;
}) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: max > 0 ? value / max : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [value, max]);

  return (
    <View style={hbStyles.row}>
      <View style={hbStyles.labelBox}>
        {icon && <Feather name={icon} size={12} color={color} />}
        <Text style={hbStyles.label}>{label}</Text>
      </View>
      <View style={hbStyles.track}>
        <Animated.View
          style={[
            hbStyles.fill,
            {
              backgroundColor: color,
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <Text style={[hbStyles.count, { color }]}>{value}</Text>
    </View>
  );
}
const hbStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  labelBox: { flexDirection: "row", alignItems: "center", gap: 5, width: 80 },
  label: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B", flex: 1 },
  track: { flex: 1, height: 8, backgroundColor: "rgba(100,116,139,0.12)", borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  count: { fontSize: 13, fontFamily: "Inter_700Bold", width: 28, textAlign: "right" },
});

function WeeklyBar({ date, count, max, isDark }: { date: string; count: number; max: number; isDark: boolean }) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: max > 0 ? count / max : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [count, max]);

  const label = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(date + "T12:00:00"));
    } catch { return date.slice(-5); }
  })();

  const MAX_BAR_HEIGHT = 60;

  return (
    <View style={wbStyles.col}>
      <Text style={[wbStyles.count, { color: isDark ? "#94A3B8" : "#64748B" }]}>{count || ""}</Text>
      <View style={[wbStyles.track, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
        <Animated.View
          style={[
            wbStyles.fill,
            {
              height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, MAX_BAR_HEIGHT] }),
              backgroundColor: count === 0 ? "transparent" : "#6366F1",
            },
          ]}
        />
      </View>
      <Text style={[wbStyles.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>{label}</Text>
    </View>
  );
}
const wbStyles = StyleSheet.create({
  col: { flex: 1, alignItems: "center", gap: 4 },
  count: { fontSize: 11, fontFamily: "Inter_600SemiBold", height: 16 },
  track: { width: 28, height: 60, borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  fill: { width: "100%", borderRadius: 6 },
  label: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

/** Monthly 30-day trend mini bar chart */
function MonthlyBar({ date, count, max, isDark }: { date: string; count: number; max: number; isDark: boolean }) {
  const heightAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: max > 0 ? count / max : 0,
      friction: 8,
      tension: 50,
      useNativeDriver: false,
    }).start();
  }, [count, max]);

  const label = (() => {
    try {
      const d = new Date(date + "T12:00:00");
      return `${d.getMonth() + 1}/${d.getDate()}`;
    } catch { return ""; }
  })();

  const MAX_BAR_HEIGHT = 48;

  return (
    <View style={mbStyles.col}>
      <View style={[mbStyles.track, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }]}>
        <Animated.View
          style={[
            mbStyles.fill,
            {
              height: heightAnim.interpolate({ inputRange: [0, 1], outputRange: [0, MAX_BAR_HEIGHT] }),
              backgroundColor: count === 0 ? "transparent" : "#818CF8",
            },
          ]}
        />
      </View>
    </View>
  );
}
const mbStyles = StyleSheet.create({
  col: { flex: 1, alignItems: "center" },
  track: { width: "80%", height: 48, borderRadius: 3, justifyContent: "flex-end", overflow: "hidden" },
  fill: { width: "100%", borderRadius: 3 },
});

export default function AnalyticsScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { token } = useAuth();

  const [exportingFormat, setExportingFormat] = useState<"csv" | "pdf" | null>(null);

  const { data, isLoading, isRefetching, refetch, isError } = useGetAdminAnalytics();
  const analytics = data?.data;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const maxPriority = analytics
    ? Math.max(analytics.criticalCount, analytics.highCount, analytics.mediumCount, analytics.lowCount, 1)
    : 1;

  const maxStatus = analytics
    ? Math.max(analytics.openCount, analytics.inProgressCount, analytics.resolvedCount, 1)
    : 1;

  const maxWeekly = analytics
    ? Math.max(...analytics.weeklyTrend.map((d) => d.count), 1)
    : 1;

  const maxMonthly = analytics
    ? Math.max(...analytics.monthlyTrend.map((d) => d.count), 1)
    : 1;

  const maxCategory = analytics
    ? Math.max(...analytics.byCategory.map((c) => c.count), 1)
    : 1;

  const maxTopAgent = analytics?.topAgents
    ? Math.max(...analytics.topAgents.map((a) => a.resolvedCount), 1)
    : 1;

  // Compute 30-day trend summary (total tickets last 30 days vs previous 30 days if available)
  const trend30 = analytics?.monthlyTrend ?? [];
  const trend30Total = trend30.reduce((s, d) => s + d.count, 0);

  async function handleExport(format: "csv" | "pdf") {
    setExportingFormat(format);
    try {
      const url = format === "csv"
        ? getExportAnalyticsCsvUrl()
        : "/api/admin/analytics/export.pdf";
      const baseUrl =
        typeof window !== "undefined" && window.location
          ? window.location.origin
          : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;
      const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

      if (Platform.OS === "web") {
        const resp = await fetch(fullUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob = await resp.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `supportdesk-report.${format}`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        if (!FileSystem.cacheDirectory) throw new Error("Temporary storage is unavailable");
        const destination = `${FileSystem.cacheDirectory}supportdesk-report.${format}`;
        const download = await FileSystem.downloadAsync(fullUrl, destination, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (download.status < 200 || download.status >= 300) {
          throw new Error(`HTTP ${download.status}`);
        }
        if (!await Sharing.isAvailableAsync()) throw new Error("Sharing is unavailable on this device");
        await Sharing.shareAsync(download.uri, {
          mimeType: format === "csv" ? "text/csv" : "application/pdf",
          dialogTitle: "Share SupportDesk report",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      Alert.alert("Export failed", msg);
    } finally {
      setExportingFormat(null);
    }
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="Analytics"
        subtitle="Ticket insights & trends"
        rightActions={
          <>
          <TouchableOpacity
            style={[s.exportBtn, exportingFormat && { opacity: 0.6 }]}
            onPress={() => void handleExport("csv")}
            disabled={Boolean(exportingFormat) || isLoading}
            activeOpacity={0.75}
          >
            {exportingFormat === "csv"
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="download" size={14} color={colors.primary} />}
            <Text style={s.exportBtnText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.exportBtn, exportingFormat && { opacity: 0.6 }]}
            onPress={() => void handleExport("pdf")}
            disabled={Boolean(exportingFormat) || isLoading}
            activeOpacity={0.75}
          >
            {exportingFormat === "pdf"
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <Feather name="file-text" size={14} color={colors.primary} />}
            <Text style={s.exportBtnText}>PDF</Text>
          </TouchableOpacity>
          </>
        }
      />

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120, paddingTop: 16 }}
      >
        {isLoading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={s.loadingText}>Loading analytics…</Text>
          </View>
        ) : isError || !analytics ? (
          <View style={s.center}>
            <Feather name="alert-circle" size={40} color={colors.destructive} style={{ opacity: 0.5 }} />
            <Text style={s.loadingText}>Failed to load analytics</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {/* Summary stat cards */}
            <View style={s.statRow}>
              <StatCard value={analytics.totalTickets}    label="Total"       color={colors.foreground} accent={colors.primary}      isDark={isDark} />
              <StatCard value={analytics.openCount}       label="Open"        color="#A5B4FC"           accent="rgba(99,102,241,0.5)" isDark={isDark} />
              <StatCard value={analytics.inProgressCount} label="In Progress" color="#FCD34D"           accent="rgba(245,158,11,0.5)" isDark={isDark} />
              <StatCard value={analytics.resolvedCount}   label="Resolved"    color="#4ADE80"           accent="rgba(34,197,94,0.5)"  isDark={isDark} />
            </View>

            {/* Avg Resolution Time + 30-day summary */}
            <View style={[s.rowCards, { marginHorizontal: 16, marginBottom: 14, gap: 10 }]}>
              {/* Avg Resolution Time */}
              <View style={[s.card, s.halfCard]}>
                <View style={s.cardHeader}>
                  <Feather name="clock" size={15} color="#818CF8" />
                  <Text style={s.cardTitle}>Avg Resolution</Text>
                </View>
                {analytics.avgResolutionHours != null ? (
                  <>
                    <Text style={[s.bigStat, { color: "#818CF8" }]}>
                      {analytics.avgResolutionHours < 24
                        ? `${analytics.avgResolutionHours.toFixed(1)}h`
                        : `${(analytics.avgResolutionHours / 24).toFixed(1)}d`}
                    </Text>
                    <Text style={[s.bigStatSub, { color: colors.mutedForeground }]}>
                      {analytics.avgResolutionHours < 24 ? "hours" : "days"} avg
                    </Text>
                  </>
                ) : (
                  <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>No data yet</Text>
                )}
              </View>

              {/* 30-day trend summary */}
              <View style={[s.card, s.halfCard]}>
                <View style={s.cardHeader}>
                  <Feather name="trending-up" size={15} color="#34D399" />
                  <Text style={s.cardTitle}>30-Day Total</Text>
                </View>
                <Text style={[s.bigStat, { color: "#34D399" }]}>{trend30Total}</Text>
                <Text style={[s.bigStatSub, { color: colors.mutedForeground }]}>tickets submitted</Text>
              </View>
            </View>

            {/* Customer satisfaction */}
            <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
              <View style={s.cardHeader}>
                <Feather name="star" size={15} color="#F59E0B" />
                <Text style={s.cardTitle}>Customer Satisfaction</Text>
                {analytics.satisfaction.ratedTicketCount > 0 && (
                  <Text style={[s.cardSubLabel, { color: colors.mutedForeground }]}>
                    {analytics.satisfaction.ratedTicketCount} rated
                  </Text>
                )}
              </View>

              {analytics.satisfaction.ratedTicketCount === 0 ? (
                <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>
                  No customer ratings yet. Ratings and feedback appear here after resolved tickets are reviewed.
                </Text>
              ) : (
                <>
                  <View style={s.satisfactionSummary}>
                    <View>
                      <View style={s.satisfactionScore}>
                        <Text style={[s.satisfactionNumber, { color: "#F59E0B" }]}>
                          {analytics.satisfaction.averageRating?.toFixed(1) ?? "—"}
                        </Text>
                        <Text style={[s.satisfactionOutOf, { color: colors.mutedForeground }]}>/ 5</Text>
                      </View>
                      <Text style={[s.satisfactionLabel, { color: colors.mutedForeground }]}>average rating</Text>
                    </View>
                    <View style={s.satisfactionStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Feather
                          key={star}
                          name="star"
                          size={16}
                          color={star <= Math.round(analytics.satisfaction.averageRating ?? 0) ? "#F59E0B" : colors.border}
                          fill={star <= Math.round(analytics.satisfaction.averageRating ?? 0) ? "#F59E0B" : "transparent"}
                        />
                      ))}
                    </View>
                  </View>

                  <View style={s.distribution}>
                    {[...analytics.satisfaction.distribution]
                      .sort((a, b) => b.rating - a.rating)
                      .map((item) => (
                        <HorizBar
                          key={item.rating}
                          label={`${item.rating} star`}
                          value={item.count}
                          max={Math.max(...analytics.satisfaction.distribution.map((rating) => rating.count), 1)}
                          color="#F59E0B"
                        />
                      ))}
                  </View>

                  {analytics.satisfaction.recentFeedback.length > 0 && (
                    <View style={s.feedbackSection}>
                      <Text style={[s.feedbackHeading, { color: colors.foreground }]}>Latest written feedback</Text>
                      {analytics.satisfaction.recentFeedback.map((feedback) => (
                        <View
                          key={feedback.ticketId}
                          style={[s.feedbackItem, { borderTopColor: colors.border }]}
                        >
                          <View style={s.feedbackMeta}>
                            <Text style={[s.feedbackProduct, { color: colors.foreground }]} numberOfLines={1}>
                              {feedback.productName}
                            </Text>
                            <View style={s.feedbackRating}>
                              <Feather name="star" size={12} color="#F59E0B" fill="#F59E0B" />
                              <Text style={s.feedbackRatingText}>{feedback.rating}</Text>
                            </View>
                          </View>
                          <Text style={[s.feedbackText, { color: colors.mutedForeground }]}>
                            “{feedback.feedbackText}”
                          </Text>
                          <Text style={[s.feedbackDate, { color: colors.mutedForeground }]}>
                            {new Date(feedback.resolvedAt ?? feedback.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Top Agents */}
            {analytics.topAgents && analytics.topAgents.length > 0 && (
              <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
                <View style={s.cardHeader}>
                  <Feather name="award" size={15} color="#F59E0B" />
                  <Text style={s.cardTitle}>Top Agents</Text>
                  <Text style={[s.cardSubLabel, { color: colors.mutedForeground }]}>by resolved tickets</Text>
                </View>
                {analytics.topAgents.map((agent, idx) => (
                  <View key={agent.agentId ?? agent.agentName} style={s.agentRow}>
                    <View style={[s.agentRank, { backgroundColor: idx === 0 ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.1)" }]}>
                      <Text style={[s.agentRankText, { color: idx === 0 ? "#F59E0B" : colors.mutedForeground }]}>#{idx + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.agentName, { color: colors.foreground }]} numberOfLines={1}>{agent.agentName}</Text>
                    </View>
                    <View style={s.agentResolvedPill}>
                      <Text style={s.agentResolvedText}>{agent.resolvedCount}</Text>
                      <Text style={[s.agentResolvedLabel, { color: colors.mutedForeground }]}>resolved</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* 30-day trend chart */}
            {trend30.length > 0 && (
              <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
                <View style={s.cardHeader}>
                  <Feather name="calendar" size={15} color="#818CF8" />
                  <Text style={s.cardTitle}>Last 30 Days</Text>
                  <Text style={[s.cardSubLabel, { color: colors.mutedForeground }]}>tickets submitted</Text>
                </View>
                <View style={s.monthlyRow}>
                  {trend30.map((d) => (
                    <MonthlyBar
                      key={d.date}
                      date={d.date}
                      count={d.count}
                      max={maxMonthly}
                      isDark={isDark}
                    />
                  ))}
                </View>
                <View style={s.monthlyLabelRow}>
                  {trend30.length > 0 && (
                    <>
                      <Text style={[s.monthlyEdgeLabel, { color: colors.mutedForeground }]}>
                        {(() => {
                          try {
                            const d = new Date(trend30[0]!.date + "T12:00:00");
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          } catch { return ""; }
                        })()}
                      </Text>
                      <Text style={[s.monthlyEdgeLabel, { color: colors.mutedForeground, textAlign: "right" }]}>
                        {(() => {
                          try {
                            const d = new Date(trend30[trend30.length - 1]!.date + "T12:00:00");
                            return `${d.getMonth() + 1}/${d.getDate()}`;
                          } catch { return ""; }
                        })()}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Priority breakdown */}
            <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
              <View style={s.cardHeader}>
                <Feather name="alert-triangle" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>By Priority</Text>
              </View>
              <HorizBar label="Critical" value={analytics.criticalCount} max={maxPriority} color="#EF4444" />
              <HorizBar label="High"     value={analytics.highCount}     max={maxPriority} color="#F97316" />
              <HorizBar label="Medium"   value={analytics.mediumCount}   max={maxPriority} color="#EAB308" />
              <HorizBar label="Low"      value={analytics.lowCount}      max={maxPriority} color="#64748B" />
            </View>

            {/* Status breakdown */}
            <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
              <View style={s.cardHeader}>
                <Feather name="activity" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>By Status</Text>
              </View>
              <HorizBar label="Open"        value={analytics.openCount}        max={maxStatus} color="#A5B4FC" />
              <HorizBar label="In Progress" value={analytics.inProgressCount}  max={maxStatus} color="#FCD34D" />
              <HorizBar label="Resolved"    value={analytics.resolvedCount}    max={maxStatus} color="#4ADE80" />
            </View>

            {/* Category breakdown */}
            {analytics.byCategory.length > 0 && (
              <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
                <View style={s.cardHeader}>
                  <Feather name="tag" size={15} color={colors.primary} />
                  <Text style={s.cardTitle}>By Category</Text>
                </View>
                {analytics.byCategory
                  .sort((a, b) => b.count - a.count)
                  .map((cat) => (
                    <HorizBar
                      key={cat.category}
                      label={cat.category.charAt(0).toUpperCase() + cat.category.slice(1)}
                      value={cat.count}
                      max={maxCategory}
                      color={colors.primary}
                      icon={CATEGORY_ICONS[cat.category]}
                    />
                  ))}
              </View>
            )}

            {/* Weekly trend */}
            <View style={[s.card, { marginHorizontal: 16, marginBottom: 14 }]}>
              <View style={s.cardHeader}>
                <Feather name="trending-up" size={15} color={colors.primary} />
                <Text style={s.cardTitle}>Last 7 Days</Text>
                <Text style={[s.cardSubLabel, { color: colors.mutedForeground }]}>Tickets submitted</Text>
              </View>
              {analytics.weeklyTrend.length === 0 ? (
                <Text style={[s.emptyLabel, { color: colors.mutedForeground }]}>No data for the last 7 days</Text>
              ) : (
                <View style={s.weeklyRow}>
                  {analytics.weeklyTrend.map((d) => (
                    <WeeklyBar
                      key={d.date}
                      date={d.date}
                      count={d.count}
                      max={maxWeekly}
                      isDark={isDark}
                    />
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        )}
      </ScrollView>

      <BottomNav
        tabs={ADMIN_TABS}
        activeKey="analytics"
        onPress={(key) => {
          if (key === "dashboard") router.navigate("/(admin)/dashboard" as never);
          if (key === "user-stats") router.navigate("/(admin)/user-stats" as never);
          if (key === "access") router.navigate("/(admin)/access" as never);
          if (key === "audit-log") router.navigate("/(admin)/audit-log" as never);
        }}
      />
    </View>
  );
}

function StatCard({ value, label, color, accent, isDark }: {
  value: number; label: string; color: string; accent: string; isDark: boolean;
}) {
  return (
    <View style={[scStyles.card, {
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderColor: isDark ? "#334155" : "#E2E8F0",
      borderTopColor: accent,
    }]}>
      <Text style={[scStyles.value, { color }]}>{value}</Text>
      <Text style={[scStyles.label, { color: isDark ? "#64748B" : "#94A3B8" }]}>{label}</Text>
    </View>
  );
}
const scStyles = StyleSheet.create({
  card: { flex: 1, borderRadius: 10, borderWidth: 1, borderTopWidth: 2, padding: 12, alignItems: "center" },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    exportBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9,
      borderWidth: 1, borderColor: colors.primary,
      backgroundColor: isDark ? "rgba(99,102,241,0.1)" : "rgba(99,102,241,0.06)",
    },
    exportBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
    scroll: { flex: 1 },
    statRow: { flexDirection: "row", paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
    rowCards: { flexDirection: "row" },
    halfCard: { flex: 1 },
    card: {
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderRadius: 14,
      borderWidth: 1,
      borderColor: isDark ? "#334155" : "#E2E8F0",
      padding: 16,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
    cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: colors.foreground, flex: 1 },
    cardSubLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
    weeklyRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 90, justifyContent: "space-between" },
    monthlyRow: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 52, justifyContent: "space-between" },
    monthlyLabelRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
    monthlyEdgeLabel: { fontSize: 10, fontFamily: "Inter_400Regular" },
    emptyLabel: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 80 },
    loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, marginTop: 4, backgroundColor: colors.primary },
    retryText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
    bigStat: { fontSize: 28, fontFamily: "Inter_700Bold", textAlign: "center" },
    bigStatSub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 2 },
    agentRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
    agentRank: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    agentRankText: { fontSize: 12, fontFamily: "Inter_700Bold" },
    agentName: { fontSize: 14, fontFamily: "Inter_500Medium" },
    agentResolvedPill: { flexDirection: "row", alignItems: "baseline", gap: 3 },
    agentResolvedText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#34D399" },
    agentResolvedLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
    satisfactionSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
    satisfactionScore: { flexDirection: "row", alignItems: "baseline" },
    satisfactionNumber: { fontSize: 32, fontFamily: "Inter_700Bold" },
    satisfactionOutOf: { fontSize: 13, fontFamily: "Inter_500Medium", marginLeft: 3 },
    satisfactionLabel: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: -2 },
    satisfactionStars: { flexDirection: "row", gap: 3 },
    distribution: { gap: 1 },
    feedbackSection: { marginTop: 12 },
    feedbackHeading: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
    feedbackItem: { borderTopWidth: 1, paddingTop: 11, marginTop: 9 },
    feedbackMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
    feedbackProduct: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold" },
    feedbackRating: { flexDirection: "row", alignItems: "center", gap: 3 },
    feedbackRatingText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#F59E0B" },
    feedbackText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginTop: 5 },
    feedbackDate: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 5 },
  });
}
