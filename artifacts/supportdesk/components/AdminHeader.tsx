import React, { type ReactNode } from "react";
import {
  ActivityIndicator, Platform, StyleSheet, Text,
  TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import ThemeToggle from "@/components/ThemeToggle";

type IconName = keyof typeof Feather.glyphMap;

// ── Icon button used in the header right area ─────────────────────────────
interface AdminHeaderIconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
  tint?: string;
}

export function AdminHeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  loading = false,
  tint,
}: AdminHeaderIconButtonProps) {
  const colors = useColors();
  const isDark = colors.isDark;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.iconBtn,
        {
          backgroundColor: isDark ? "rgba(255,255,255,0.06)" : colors.secondary,
          borderColor: isDark ? "rgba(255,255,255,0.10)" : colors.border,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.65}
      hitSlop={4}
    >
      {loading
        ? <ActivityIndicator size="small" color={tint ?? colors.foreground} />
        : <Feather name={icon} size={16} color={tint ?? colors.foreground} />}
    </TouchableOpacity>
  );
}

// ── Avatar initials bubble ────────────────────────────────────────────────
function AvatarBubble({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      {/* Online indicator */}
      <View style={styles.onlineDot} />
    </View>
  );
}

// ── AdminHeader ───────────────────────────────────────────────────────────
interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: ReactNode;
  leadingAction?: ReactNode;
  showThemeToggle?: boolean;
  showAccountActions?: boolean;
}

export default function AdminHeader({
  title,
  subtitle,
  rightActions,
  leadingAction,
  showThemeToggle = true,
  showAccountActions = true,
}: AdminHeaderProps) {
  const colors  = useColors();
  const isDark  = colors.isDark;
  const { user, logout } = useAuth();
  const router  = useRouter();
  const { width } = useWindowDimensions();
  const isCompact = width < 480;

  const identity = subtitle ?? `${user?.name ?? "Admin"} · ${user?.email ?? "—"}`;

  // Bottom border glow on dark mode
  const bottomBorderStyle = isDark
    ? { borderBottomColor: "rgba(47,128,237,0.14)", borderBottomWidth: 1 }
    : { borderBottomColor: colors.border, borderBottomWidth: 1 };

  const webGlow = Platform.OS === "web" && isDark
    ? ({ boxShadow: "0 1px 0 rgba(47,128,237,0.13), 0 4px 18px rgba(0,0,0,0.5)" } as object)
    : {};

  return (
    <View
      style={[
        styles.header,
        isCompact && styles.headerCompact,
        { backgroundColor: isDark ? colors.background : "#FFFFFF" },
        bottomBorderStyle,
        webGlow,
      ]}
    >
      {leadingAction}

      {/* Left — badge + title + sub */}
      <View style={[styles.headerLeft, isCompact && styles.headerLeftCompact]}>
        <View style={styles.adminBadgeRow}>
          <View style={styles.adminPill}>
            <Feather name="shield" size={9} color="#2F80ED" />
            <Text style={styles.adminPillText}>ADMIN</Text>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          {title}
        </Text>
        <Text style={[styles.sub, { color: isDark ? "#5A7A9B" : colors.mutedForeground }]} numberOfLines={1}>
          {identity}
        </Text>
      </View>

      {/* Right — actions + toggle + avatar */}
      <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
        {rightActions}
        {showThemeToggle && <ThemeToggle size={36} />}
        {showAccountActions && (
          <>
            <AdminHeaderIconButton
              icon="user"
              accessibilityLabel="Open admin profile"
              onPress={() => router.navigate("/(admin)/profile" as never)}
            />
            <AdminHeaderIconButton
              icon="log-out"
              accessibilityLabel="Sign out"
              onPress={logout}
              tint={isDark ? "#EF4444" : undefined}
            />
          </>
        )}
        {/* Avatar shown when compact layout hides the sub-line */}
        {showAccountActions && !isCompact && user?.name && (
          <AvatarBubble name={user.name} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerCompact: { flexWrap: "wrap", alignItems: "stretch" },

  headerLeft: { flex: 1, gap: 2, minWidth: 0 },
  headerLeftCompact: { flexBasis: "100%" },

  adminBadgeRow: { marginBottom: 3 },
  adminPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(47,128,237,0.12)",
    borderWidth: 1,
    borderColor: "rgba(47,128,237,0.28)",
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  adminPillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#3B9EFF",
    letterSpacing: 1,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },

  headerRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
  headerRightCompact: { width: "100%", justifyContent: "flex-end", marginTop: 8 },

  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 2,
  },

  avatarWrap: { position: "relative", marginLeft: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#2F80ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(47,128,237,0.45)",
  },
  avatarText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#00D4AA",
    borderWidth: 1.5,
    borderColor: "#060E1E",
  },
});