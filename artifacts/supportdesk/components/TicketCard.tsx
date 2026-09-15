import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from "react-native";
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
  slaDeadline?: string | null;
}

const PRIORITY_CONFIG = {
  critical: { color: "#EF4444", label: "Critical", icon: "alert-octagon"    as const, glowAlpha: "0.22" },
  high:     { color: "#F97316", label: "High",     icon: "alert-triangle"   as const, glowAlpha: "0.18" },
  medium:   { color: "#2F80ED", label: "Medium",   icon: "minus-circle"     as const, glowAlpha: "0.16" },
  low:      { color: "#445672", label: "Low",       icon: "arrow-down-circle" as const, glowAlpha: "0.10" },
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  bug:     "alert-circle",
  feature: "star",
  billing: "credit-card",
  account: "user",
  other:   "help-circle",
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
      month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(isoString));
  } catch { return "—"; }
}

/** Returns 0–1 fraction of SLA elapsed (0 = fresh, 1 = expired) */
function slaPct(createdAt: string, deadline: string | null | undefined): number | null {
  if (!deadline) return null;
  try {
    const total = new Date(deadline).getTime() - new Date(createdAt).getTime();
    const elapsed = Date.now() - new Date(createdAt).getTime();
    return Math.min(Math.max(elapsed / total, 0), 1);
  } catch { return null; }
}

function SlaBar({ pct, priority }: { pct: number; priority: string }) {
  const cfg = PRIORITY_CONFIG[priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
  const barColor = pct >= 1 ? "#EF4444" : pct >= 0.75 ? "#F59E0B" : cfg.color;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct,
      duration: 800,
      delay: 200,
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={slaStyles.track}>
      <Animated.View style={[slaStyles.fill, { width: barWidth, backgroundColor: barColor }]} />
    </View>
  );
}

const slaStyles = StyleSheet.create({
  track: {
    height: 3, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.07)",
    overflow: "hidden", marginTop: 10,
  },
  fill: { height: 3, borderRadius: 2 },
});

export default function TicketCard({ ticket, index = 0 }: { ticket: Ticket; index?: number }) {
  const colors = useColors();
  const router  = useRouter();
  const isDark  = colors.isDark;

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const delay = Math.min(index * 55, 420);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 360, delay, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, delay, friction: 8, tension: 58, useNativeDriver: true }),
    ]).start();
  }, []);

  function onPressIn()  { Animated.spring(pressScale, { toValue: 0.975, useNativeDriver: true, friction: 9 }).start(); }
  function onPressOut() { Animated.spring(pressScale, { toValue: 1,     useNativeDriver: true, friction: 6 }).start(); }

  const priority = ticket.priority ?? "medium";
  const category = ticket.category ?? "other";
  const pCfg  = PRIORITY_CONFIG[priority];
  const catIcon = CATEGORY_ICONS[category] ?? "help-circle";
  const age   = formatAge(ticket.createdAt);
  const sla   = slaPct(ticket.createdAt, ticket.slaDeadline);

  // Card border — glowing left stripe colour as a subtle top border on dark mode
  const cardBorderColor = isDark
    ? `rgba(${hexToRgb(pCfg.color)},0.18)`
    : colors.border;

  const webGlow = Platform.OS === "web" && isDark
    ? ({ boxShadow: `0 0 0 1px ${pCfg.color}22, 0 4px 24px rgba(0,0,0,0.45)` } as object)
    : {};

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: pressScale }],
      }}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: isDark ? colors.card : "#FFFFFF",
            borderColor: cardBorderColor,
          },
          webGlow,
        ]}
        onPress={() => router.push(`/user-ticket/${ticket.id}` as never)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* ── Priority stripe — left edge ─────────────────────────── */}
        <View style={[styles.priorityStripe, { backgroundColor: pCfg.color }]} />

        {/* ── Content area ────────────────────────────────────────── */}
        <View style={styles.content}>

          {/* Top row: product name + status badge */}
          <View style={styles.topRow}>
            <View style={styles.topLeft}>
              <Text style={[styles.productName, { color: colors.foreground }]} numberOfLines={1}>
                {ticket.productName}
              </Text>
            </View>
            <StatusBadge status={ticket.status} size="sm" />
          </View>

          {/* Description */}
          <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={2}>
            {ticket.description}
          </Text>

          {/* Meta chips row */}
          <View style={styles.metaRow}>
            {/* Category chip */}
            <View style={[styles.chip, { backgroundColor: isDark ? colors.muted : colors.secondary, borderColor: isDark ? "rgba(255,255,255,0.07)" : colors.border }]}>
              <Feather name={catIcon} size={10} color={colors.mutedForeground} />
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </View>

            {/* Priority chip */}
            <View style={[styles.chip, { backgroundColor: `${pCfg.color}18`, borderColor: `${pCfg.color}40` }]}>
              <Feather name={pCfg.icon} size={10} color={pCfg.color} />
              <Text style={[styles.chipText, { color: pCfg.color }]}>{pCfg.label}</Text>
            </View>

            {/* Age chip (open tickets only) */}
            {ticket.status === "open" && age ? (
              <View style={[styles.chip, { backgroundColor: isDark ? colors.muted : colors.secondary, borderColor: isDark ? "rgba(255,255,255,0.07)" : colors.border }]}>
                <Feather name="clock" size={10} color={priority === "critical" ? "#EF4444" : colors.mutedForeground} />
                <Text style={[styles.chipText, { color: priority === "critical" ? "#EF4444" : colors.mutedForeground }]}>
                  {age}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Bottom row: date + ID + chevron */}
          <View style={[styles.bottomRow, { borderTopColor: isDark ? "rgba(255,255,255,0.05)" : colors.border }]}>
            <View style={styles.dateRow}>
              <Feather name="calendar" size={11} color={colors.mutedForeground} />
              <Text style={[styles.dateText, { color: colors.mutedForeground }]}>
                {formatDate(ticket.createdAt)}
              </Text>
            </View>
            <View style={styles.rightRow}>
              <Text style={[styles.idText, { color: isDark ? "#445672" : colors.mutedForeground }]}>
                #{ticket.id.slice(-6)}
              </Text>
              <View style={[styles.chevronCircle, { backgroundColor: isDark ? colors.muted : colors.secondary }]}>
                <Feather name="chevron-right" size={12} color={colors.primary} />
              </View>
            </View>
          </View>

          {/* SLA progress bar — only when slaDeadline is present & ticket not resolved */}
          {sla !== null && ticket.status !== "resolved" && (
            <SlaBar pct={sla} priority={priority} />
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Converts "#RRGGBB" → "R,G,B" for rgba() usage */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "47,128,237";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  priorityStripe: {
    width: 4,
    minHeight: "100%",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    padding: 14,
    paddingLeft: 13,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  topLeft: { flex: 1 },
  productName: {
    fontSize: 15,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
    marginBottom: 9,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
    marginBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  bottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 9,
    borderTopWidth: 1,
  },
  dateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular" },
  rightRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  idText:   { fontSize: 11, fontFamily: "Inter_400Regular" },
  chevronCircle: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
});
