import React, { type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import ThemeToggle from "@/components/ThemeToggle";

type IconName = keyof typeof Feather.glyphMap;

interface AdminHeaderIconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  loading?: boolean;
}

export function AdminHeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled = false,
  loading = false,
}: AdminHeaderIconButtonProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const styles = makeStyles(colors, isDark);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.iconBtn}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.68}
      hitSlop={4}
    >
      {loading
        ? <ActivityIndicator size="small" color={colors.foreground} />
        : <Feather name={icon} size={15} color={colors.foreground} />}
    </TouchableOpacity>
  );
}

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
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const styles = makeStyles(colors, isDark);
  const identity = subtitle ?? `${user?.name ?? "Admin"} · ${user?.email ?? "—"}`;
  const isCompact = width < 480;

  return (
    <View style={[styles.header, isCompact && styles.headerCompact]}>
      {leadingAction}
      <View style={[styles.headerLeft, isCompact && styles.headerLeftCompact]}>
        <View style={styles.adminPill}>
          <Feather name="shield" size={9} color="#A5B4FC" />
          <Text style={styles.adminPillText}>ADMIN</Text>
        </View>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub} numberOfLines={2}>{identity}</Text>
      </View>
      <View style={[styles.headerRight, isCompact && styles.headerRightCompact]}>
        {rightActions}
        {showThemeToggle ? <ThemeToggle size={36} /> : null}
        {showAccountActions ? (
          <>
            <AdminHeaderIconButton
              icon="user"
              accessibilityLabel="Open admin profile"
              onPress={() => router.navigate("/(admin)/profile" as never)}
            />
            <AdminHeaderIconButton icon="log-out" accessibilityLabel="Sign out" onPress={logout} />
          </>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerCompact: { flexWrap: "wrap", alignItems: "stretch" },
    headerLeft: { flex: 1, gap: 3, minWidth: 0 },
    headerLeftCompact: { flexBasis: "100%" },
    adminPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: "rgba(99,102,241,0.15)",
      borderWidth: 1,
      borderColor: "rgba(99,102,241,0.3)",
      borderRadius: 5,
      paddingHorizontal: 7,
      paddingVertical: 3,
      alignSelf: "flex-start",
      marginBottom: 3,
    },
    adminPillText: {
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      color: "#A5B4FC",
      letterSpacing: 0.8,
    },
    headerTitle: {
      fontSize: 21,
      lineHeight: 25,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    headerSub: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: "Inter_400Regular",
      color: isDark ? "#CBD5E1" : colors.mutedForeground,
    },
    headerRight: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0 },
    headerRightCompact: { width: "100%", justifyContent: "flex-end", marginTop: 6 },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255,255,255,0.08)" : colors.secondary,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.14)" : colors.border,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: isDark ? "#000000" : "#94A3B8",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.24 : 0.12,
      shadowRadius: 5,
      elevation: 2,
    },
  });
}