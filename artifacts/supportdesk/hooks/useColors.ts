import { useTheme } from "@/contexts/ThemeContext";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current theme (light = day, dark = night).
 * Also exposes shared semantic maps (priority colors, glow presets, radius scale).
 * Theme is controlled by ThemeContext and can be toggled via the header button.
 */
export function useColors() {
  const { theme } = useTheme();
  const palette = theme === "dark" ? colors.dark : colors.light;
  return {
    ...palette,
    // Shared across themes
    priority: colors.priority,
    glow: colors.glow,
    radius: colors.radius,
    radiusSm: colors.radiusSm,
    radiusLg: colors.radiusLg,
    isDark: theme === "dark",
  };
}
