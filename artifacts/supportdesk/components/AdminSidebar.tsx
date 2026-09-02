import React, { useMemo } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

type IconName = keyof typeof Feather.glyphMap;

const ITEMS: { key: string; label: string; icon: IconName; href: string }[] = [
  { key: "dashboard", label: "Tickets", icon: "inbox", href: "/(admin)/dashboard" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-2", href: "/(admin)/analytics" },
  { key: "user-stats", label: "Users", icon: "users", href: "/(admin)/user-stats" },
  { key: "access", label: "Access", icon: "key", href: "/(admin)/access" },
  { key: "audit-log", label: "Audit", icon: "shield", href: "/(admin)/audit-log" },
];

function itemIsActive(pathname: string, key: string) {
  if (key === "dashboard") return pathname.includes("/dashboard") || pathname.includes("/ticket/");
  return pathname.includes(`/${key}`);
}

export default function AdminSidebar() {
  const { width } = useWindowDimensions();
  const colors = useColors();
  const { isDark } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const styles = makeStyles(colors, isDark);
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  const activeKey = useMemo(
    () => ITEMS.find((item) => itemIsActive(pathname, item.key))?.key ?? "dashboard",
    [pathname],
  );

  if (!isDesktopWeb) return null;

  return (
    <View style={styles.sidebar} accessibilityLabel="Admin navigation">
      <View style={styles.brandBlock}>
        <View style={styles.brandMark}>
          <Feather name="life-buoy" size={18} color={colors.primaryForeground} />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>SupportDesk</Text>
          <Text style={styles.brandCaption}>Operations console</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>Workspace</Text>
      <View style={styles.navList}>
        {ITEMS.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <TouchableOpacity
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Open ${item.label}`}
              style={[styles.navItem, isActive && styles.navItemActive]}
              onPress={() => router.navigate(item.href as never)}
              activeOpacity={0.76}
            >
              <View style={[styles.navIcon, isActive && styles.navIconActive]}>
                <Feather
                  name={item.icon}
                  size={17}
                  color={isActive ? colors.primary : colors.mutedForeground}
                />
              </View>
              <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>{item.label}</Text>
              {isActive && <View style={styles.activeRail} />}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sidebarBottom}>
        <View style={styles.statusCard}>
          <View style={styles.statusDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.statusTitle}>All systems operational</Text>
            <Text style={styles.statusCaption}>Ticket intake is live</Text>
          </View>
        </View>
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.modeLabel}>Appearance</Text>
            <Text style={styles.modeValue}>{isDark ? "Night shift" : "Day shift"}</Text>
          </View>
          <ThemeToggle size={34} />
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    sidebar: {
      width: 236,
      flexShrink: 0,
      minHeight: "100%",
      paddingTop: 70,
      paddingHorizontal: 14,
      paddingBottom: 22,
      backgroundColor: isDark ? "#111D35" : "#F7F9FC",
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    brandBlock: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 7 },
    brandMark: {
      width: 34,
      height: 34,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.22,
      shadowRadius: 8,
      elevation: 3,
    },
    brandCopy: { flex: 1 },
    brandName: { color: colors.foreground, fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
    brandCaption: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 7, marginTop: 25, marginBottom: 22 },
    sectionLabel: {
      color: colors.mutedForeground,
      fontSize: 10,
      fontFamily: "Inter_700Bold",
      letterSpacing: 1.1,
      textTransform: "uppercase",
      paddingHorizontal: 10,
      marginBottom: 8,
    },
    navList: { gap: 4 },
    navItem: {
      height: 46,
      borderRadius: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 8,
      position: "relative",
    },
    navItemActive: { backgroundColor: isDark ? "rgba(99,102,241,0.16)" : "rgba(99,102,241,0.09)" },
    navIcon: { width: 30, height: 30, alignItems: "center", justifyContent: "center", borderRadius: 8 },
    navIconActive: { backgroundColor: isDark ? "rgba(99,102,241,0.2)" : "rgba(99,102,241,0.12)" },
    navLabel: { color: colors.mutedForeground, fontSize: 13, fontFamily: "Inter_500Medium" },
    navLabelActive: { color: colors.primary, fontFamily: "Inter_700Bold" },
    activeRail: {
      position: "absolute",
      width: 3,
      height: 22,
      borderRadius: 3,
      right: -14,
      backgroundColor: colors.primary,
    },
    sidebarBottom: { marginTop: "auto", gap: 18, paddingHorizontal: 7 },
    statusCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      padding: 11,
      borderWidth: 1,
      borderColor: isDark ? "rgba(34,197,94,0.16)" : "rgba(34,197,94,0.22)",
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(34,197,94,0.07)" : "rgba(34,197,94,0.06)",
    },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
    statusTitle: { color: colors.foreground, fontSize: 10, fontFamily: "Inter_600SemiBold" },
    statusCaption: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular", marginTop: 2 },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 3,
    },
    modeLabel: { color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_400Regular" },
    modeValue: { color: colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  });
}