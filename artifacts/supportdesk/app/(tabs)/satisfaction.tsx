import React from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useGetTicketSatisfaction } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav, { NavTab } from "@/components/BottomNav";

const USER_TABS: NavTab[] = [
  { key: "index", label: "New Ticket", icon: "plus-circle", iconActive: "plus-circle" },
  { key: "history", label: "My Tickets", icon: "list", iconActive: "list" },
  { key: "satisfaction", label: "Satisfaction", icon: "star", iconActive: "star" },
];
const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

function Stars({ rating, color, size = 16 }: { rating: number; color: string; size?: number }) {
  return <View style={styles.stars}>{[1, 2, 3, 4, 5].map((value) => <Feather key={value} name="star" size={size} color={value <= Math.round(rating) ? color : "#CBD5E1"} />)}</View>;
}

export default function SatisfactionScreen() {
  const router = useRouter();
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { data, isLoading, isRefetching, isError, refetch } = useGetTicketSatisfaction();
  const satisfaction = data?.data;
  const maxDistribution = Math.max(...(satisfaction?.distribution.map((item) => item.count) ?? []), 1);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const s = makeStyles(colors, isDark);

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={[s.header, BLUR]}>
        <View>
          <Text style={s.headerTitle}>Satisfaction</Text>
          <Text style={s.headerSub}>Your support feedback at a glance</Text>
        </View>
        <View style={s.headerActions}>
          <ThemeToggle size={36} />
          <TouchableOpacity style={s.iconBtn} onPress={() => refetch()} disabled={isRefetching}>
            {isRefetching ? <ActivityIndicator size="small" color={colors.primary} /> : <Feather name="refresh-cw" size={15} color={colors.mutedForeground} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 110 }]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />}
      >
        {isLoading ? <View style={s.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={s.centerText}>Loading feedback…</Text></View>
          : isError || !satisfaction ? <View style={s.center}><Feather name="alert-circle" size={40} color={colors.destructive} /><Text style={s.centerTitle}>Couldn’t load satisfaction</Text><TouchableOpacity style={s.retryButton} onPress={() => refetch()}><Text style={s.retryText}>Try again</Text></TouchableOpacity></View>
            : satisfaction.ratedTicketCount === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIcon}><Feather name="star" size={26} color={colors.primary} /></View>
                <Text style={s.emptyTitle}>No ratings yet</Text>
                <Text style={s.emptyText}>When a ticket is resolved, you can rate the support you received. Your feedback helps improve future requests.</Text>
                <TouchableOpacity style={s.ticketsButton} onPress={() => router.navigate("/(tabs)/history" as never)}><Text style={s.ticketsButtonText}>View my tickets</Text><Feather name="arrow-right" size={15} color="#fff" /></TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={s.scoreCard}>
                  <View style={s.scoreIcon}><Feather name="award" size={24} color="#fff" /></View>
                  <Text style={s.scoreLabel}>Your average rating</Text>
                  <Text style={s.scoreValue}>{satisfaction.averageRating?.toFixed(1)}</Text>
                  <Stars rating={satisfaction.averageRating ?? 0} color="#FBBF24" size={19} />
                  <Text style={s.scoreCaption}>Based on {satisfaction.ratedTicketCount} rated ticket{satisfaction.ratedTicketCount === 1 ? "" : "s"}</Text>
                </View>

                <View style={s.card}>
                  <Text style={s.cardTitle}>Rating distribution</Text>
                  <Text style={s.cardSub}>How you rated your resolved requests</Text>
                  <View style={s.distribution}>
                    {[...satisfaction.distribution].reverse().map((item) => (
                      <View key={item.rating} style={s.distributionRow}>
                        <Text style={s.distributionLabel}>{item.rating}</Text>
                        <Feather name="star" size={13} color="#FBBF24" />
                        <View style={s.track}><View style={[s.fill, { width: `${(item.count / maxDistribution) * 100}%` }]} /></View>
                        <Text style={s.count}>{item.count}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={s.feedbackSection}>
                  <Text style={s.feedbackHeading}>Recent feedback</Text>
                  {satisfaction.recentFeedback.length ? satisfaction.recentFeedback.map((feedback) => (
                    <View key={feedback.ticketId} style={s.feedbackCard}>
                      <View style={s.feedbackTop}><Text style={s.feedbackProduct} numberOfLines={1}>{feedback.productName}</Text><Stars rating={feedback.rating} color="#FBBF24" size={13} /></View>
                      <Text style={s.feedbackText}>{feedback.feedbackText}</Text>
                      <Text style={s.feedbackDate}>{new Date(feedback.resolvedAt ?? feedback.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</Text>
                    </View>
                  )) : <View style={s.noFeedback}><Feather name="message-square" size={18} color={colors.mutedForeground} /><Text style={s.centerText}>Your ratings do not include written feedback yet.</Text></View>}
                </View>
              </>
            )}
      </ScrollView>

      <BottomNav tabs={USER_TABS} activeKey="satisfaction" onPress={(key) => {
        if (key === "index") router.navigate("/(tabs)/" as never);
        if (key === "history") router.navigate("/(tabs)/history" as never);
      }} />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 15, backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(248,250,252,0.95)", borderBottomWidth: 1, borderBottomColor: colors.border },
    headerTitle: { fontSize: 19, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8 },
    iconBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 14 },
    center: { alignItems: "center", paddingVertical: 68, paddingHorizontal: 30, gap: 10 },
    centerTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground },
    centerText: { fontSize: 13, lineHeight: 19, textAlign: "center", fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryButton: { paddingHorizontal: 17, paddingVertical: 9, borderRadius: 8, backgroundColor: colors.primary },
    retryText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    emptyCard: { alignItems: "center", padding: 25, gap: 10, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    emptyIcon: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.09)" },
    emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    emptyText: { fontSize: 13, lineHeight: 20, textAlign: "center", fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    ticketsButton: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 9, backgroundColor: colors.primary, marginTop: 3 },
    ticketsButtonText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
    scoreCard: { alignItems: "center", paddingVertical: 23, paddingHorizontal: 20, gap: 6, borderRadius: 17, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.23, shadowRadius: 13, elevation: 4 },
    scoreIcon: { width: 43, height: 43, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "rgba(255,255,255,0.17)", marginBottom: 2 },
    scoreLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
    scoreValue: { fontSize: 40, lineHeight: 45, fontFamily: "Inter_700Bold", color: "#fff" },
    scoreCaption: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.82)", marginTop: 3 },
    card: { padding: 17, borderRadius: 15, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground },
    cardSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 3 },
    distribution: { marginTop: 17, gap: 10 },
    distributionRow: { flexDirection: "row", alignItems: "center", gap: 7 },
    distributionLabel: { width: 9, fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    track: { flex: 1, height: 8, borderRadius: 5, overflow: "hidden", backgroundColor: isDark ? "#334155" : "#E2E8F0" },
    fill: { height: "100%", minWidth: 0, borderRadius: 5, backgroundColor: "#FBBF24" },
    count: { width: 18, textAlign: "right", fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    feedbackSection: { gap: 9 },
    feedbackHeading: { fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground, paddingHorizontal: 2 },
    feedbackCard: { padding: 14, gap: 7, borderRadius: 13, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    feedbackTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    feedbackProduct: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    feedbackText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    feedbackDate: { fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    noFeedback: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 20, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: colors.card },
  });
}

const styles = StyleSheet.create({
  stars: { flexDirection: "row", gap: 2 },
});