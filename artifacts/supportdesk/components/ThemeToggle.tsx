import React, { useRef } from "react";
import { TouchableOpacity, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  size?: number;
}

export default function ThemeToggle({ size = 36 }: Props) {
  const { isDark, toggleTheme } = useTheme();
  const colors  = useColors();
  const spinAnim = useRef(new Animated.Value(0)).current;

  function handleToggle() {
    toggleTheme();
    Animated.sequence([
      Animated.timing(spinAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start(() => spinAnim.setValue(0));
  }

  const rotate = spinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const scale = spinAnim.interpolate({
    inputRange:  [0,   0.3, 0.55, 0.75, 1],
    outputRange: [1,  0.35, 0.35,  1.2,  1],
  });

  const iconName: keyof typeof Feather.glyphMap = isDark ? "sun" : "moon";
  const iconColor = isDark ? "#FCD34D" : "#2F80ED";

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          width: size,
          height: size,
          backgroundColor: isDark ? "rgba(252,211,77,0.08)" : colors.secondary,
          borderColor:     isDark ? "rgba(252,211,77,0.22)" : colors.border,
          shadowColor:     isDark ? "#FCD34D" : "#2F80ED",
          shadowOpacity:   isDark ? 0.22      : 0.10,
        },
      ]}
      onPress={handleToggle}
      activeOpacity={0.72}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={isDark ? "Switch to light theme" : "Switch to dark theme"}
      accessibilityState={{ selected: isDark }}
    >
      <Animated.View style={{ transform: [{ rotate }, { scale }] }}>
        <Feather name={iconName} size={16} color={iconColor} />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
});
