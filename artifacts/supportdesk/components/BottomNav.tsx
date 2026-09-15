import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export interface NavTab {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  iconActive: keyof typeof Feather.glyphMap;
  badge?: number;
}

interface BottomNavProps {
  tabs: NavTab[];
  activeKey: string;
  onPress: (key: string) => void;
}

const BLUR_WEB = Platform.OS === "web"
  ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object)
  : {};

// ── Individual tab button ─────────────────────────────────────────────────
function TabButton({
  tab,
  isActive,
  onPress,
}: {
  tab: NavTab;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors    = useColors();
  const isDark    = colors.isDark;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillAnim  = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const colorAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(pillAnim,  { toValue: isActive ? 1 : 0, friction: 7, tension: 80, useNativeDriver: false }),
      Animated.timing(colorAnim, { toValue: isActive ? 1 : 0, duration: 180, useNativeDriver: false }),
    ]).start();
  }, [isActive]);

  function handlePress() {
    if (isActive) return;
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.82, friction: 6, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1,    friction: 5, useNativeDriver: true }),
    ]).start();
    onPress();
  }

  const pillBg = pillAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["rgba(47,128,237,0)", isDark ? "rgba(47,128,237,0.18)" : "rgba(47,128,237,0.12)"],
  });

  const iconColor = colorAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [isDark ? "#445672" : "#7A9FC4", "#2F80ED"],
  });

  const labelColor = colorAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [isDark ? "#445672" : "#7A9FC4", "#2F80ED"],
  });

  return (
    <Animated.View style={[styles.tabFlex, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.tabTouch}>
        <Animated.View style={[styles.tabPill, { backgroundColor: pillBg }]}>
          {/* Active glow dot indicator */}
          {isActive && (
            <View style={styles.activeDot} />
          )}

          <Animated.Text style={{ color: iconColor }}>
            <Feather
              name={isActive ? tab.iconActive : tab.icon}
              size={20}
              color={isActive ? "#2F80ED" : (isDark ? "#445672" : "#7A9FC4")}
            />
          </Animated.Text>

          <Animated.Text
            style={[
              styles.tabLabel,
              {
                color: labelColor,
                fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular",
              },
            ]}
          >
            {tab.label}
          </Animated.Text>

          {/* Notification badge */}
          {tab.badge && tab.badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{tab.badge > 99 ? "99+" : tab.badge}</Text>
            </View>
          ) : null}
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Bottom nav bar ────────────────────────────────────────────────────────
export default function BottomNav({ tabs, activeKey, onPress }: BottomNavProps) {
  const colors  = useColors();
  const isDark  = colors.isDark;
  const insets  = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  const mountY       = useRef(new Animated.Value(30)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 380, delay: 100, useNativeDriver: true }),
      Animated.spring(mountY,       { toValue: 0, delay: 100, friction: 8, tension: 55, useNativeDriver: true }),
    ]).start();
  }, []);

  if (isDesktopWeb) return null;

  const barBg = isDark
    ? "rgba(6,14,30,0.88)"
    : "rgba(255,255,255,0.90)";

  const barShadow = isDark
    ? { shadowColor: "#000",        shadowOpacity: 0.55, shadowRadius: 24 }
    : { shadowColor: "#2F80ED",     shadowOpacity: 0.12, shadowRadius: 18 };

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom + (Platform.OS === "web" ? 14 : 10), 22) },
        { opacity: mountOpacity, transform: [{ translateY: mountY }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          BLUR_WEB,
          {
            backgroundColor: barBg,
            borderColor: isDark ? "rgba(255,255,255,0.07)" : "rgba(47,128,237,0.12)",
            ...barShadow,
          },
        ]}
      >
        {tabs.map((tab) => (
          <TabButton
            key={tab.key}
            tab={tab}
            isActive={activeKey === tab.key}
            onPress={() => onPress(tab.key)}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    left: 14,
    right: 14,
    zIndex: 100,
    maxWidth: 720,
    alignSelf: "center",
  },
  bar: {
    flexDirection: "row",
    borderRadius: 26,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    shadowOffset: { width: 0, height: 8 },
    alignItems: "center",
  },
  tabFlex:  { flex: 1 },
  tabTouch: { alignItems: "stretch" },
  tabPill: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: 18,
    minHeight: 60,
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    top: 6,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#2F80ED",
    shadowColor: "#2F80ED",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 4,
    elevation: 4,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    letterSpacing: 0.1,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 12,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    lineHeight: 12,
  },
});
