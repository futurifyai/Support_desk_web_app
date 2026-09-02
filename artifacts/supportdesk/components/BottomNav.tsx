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
import { useTheme } from "@/contexts/ThemeContext";

export interface NavTab {
  key: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  iconActive: keyof typeof Feather.glyphMap;
}

interface BottomNavProps {
  tabs: NavTab[];
  activeKey: string;
  onPress: (key: string) => void;
}

const BLUR_WEB = Platform.OS === "web"
  ? ({ backdropFilter: "blur(16px)" } as object)
  : {};

function TabButton({
  tab,
  isActive,
  onPress,
}: {
  tab: NavTab;
  isActive: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const activeBg = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const iconColor = useRef(new Animated.Value(isActive ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(activeBg, {
        toValue: isActive ? 1 : 0,
        friction: 7,
        tension: 70,
        useNativeDriver: false,
      }),
      Animated.timing(iconColor, {
        toValue: isActive ? 1 : 0,
        duration: 180,
        useNativeDriver: false,
      }),
    ]).start();
  }, [isActive]);

  function handlePress() {
    if (isActive) return;
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.85,
        friction: 5,
        useNativeDriver: false,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        useNativeDriver: false,
      }),
    ]).start();
    onPress();
  }

  const pillBg = activeBg.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(99,102,241,0)", "rgba(99,102,241,0.16)"],
  });

  const labelColor = iconColor.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.mutedForeground, colors.primary],
  });

  return (
    <Animated.View style={[styles.tabFlex, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.tabTouch}>
        <Animated.View style={[styles.tabPill, { backgroundColor: pillBg }]}>
          <Feather
            name={isActive ? tab.iconActive : tab.icon}
            size={19}
            color={isActive ? colors.primary : colors.mutedForeground}
          />
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
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function BottomNav({ tabs, activeKey, onPress }: BottomNavProps) {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  const mountAnim = useRef(new Animated.Value(24)).current;
  const mountOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(mountOpacity, { toValue: 1, duration: 350, delay: 80, useNativeDriver: false }),
      Animated.spring(mountAnim, { toValue: 0, delay: 80, friction: 8, tension: 55, useNativeDriver: false }),
    ]).start();
  }, []);

  if (isDesktopWeb) return null;

  const barBg = isDark ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.92)";

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { bottom: Math.max(insets.bottom + (Platform.OS === "web" ? 12 : 8), 20) },
        { opacity: mountOpacity, transform: [{ translateY: mountAnim }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.bar,
          BLUR_WEB,
          {
            backgroundColor: barBg,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.07)",
            shadowColor: isDark ? "#000" : colors.primary,
            shadowOpacity: isDark ? 0.4 : 0.12,
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
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    shadowOffset: { width: 0, height: 7 },
    shadowRadius: 20,
    elevation: 10,
    alignItems: "center",
  },
  tabFlex: { flex: 1 },
  tabTouch: { alignItems: "stretch" },
  tabPill: {
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 4,
    paddingVertical: 8,
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 58,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    textAlign: "center",
    maxWidth: 84,
  },
});
