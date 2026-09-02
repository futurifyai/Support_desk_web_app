import React, { useRef } from "react";
import { TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  size?: number;
}

export default function ThemeToggle({ size = 34 }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const colors = useColors();
  const spinAnim = useRef(new Animated.Value(0)).current;

  function handleToggle() {
    toggleTheme();
    Animated.timing(spinAnim, {
      toValue: 1,
      duration: 420,
      useNativeDriver: true,
    }).start(() => spinAnim.setValue(0));
  }

  const rotate = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const scale = spinAnim.interpolate({
    inputRange: [0, 0.3, 0.55, 0.75, 1],
    outputRange: [1, 0.4, 0.4, 1.15, 1],
  });

  return (
    <TouchableOpacity
      style={[styles.btn, {
        width: size,
        height: size,
        backgroundColor: isDark ? "rgba(255,255,255,0.08)" : colors.secondary,
        borderColor: isDark ? "rgba(255,255,255,0.14)" : colors.border,
        shadowColor: isDark ? "#000000" : "#94A3B8",
        shadowOpacity: isDark ? 0.24 : 0.12,
      }]}
      onPress={handleToggle}
      activeOpacity={0.75}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      accessibilityState={{ selected: isDark }}
    >
      <Animated.View style={{ transform: [{ rotate }, { scale }] }}>
        <Feather name={isDark ? "sun" : "moon"} size={15} color={colors.foreground} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 2,
  },
});
