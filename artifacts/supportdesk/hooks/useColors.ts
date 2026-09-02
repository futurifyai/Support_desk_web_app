import { useTheme } from "@/contexts/ThemeContext";
import colors from "@/constants/colors";

/**
 * Returns the design tokens for the current theme (light = day, dark = night).
 * Theme is controlled by ThemeContext — defaults to system preference and can
 * be manually toggled by the user via the sun/moon button in any screen header.
 */
export function useColors() {
  const { theme } = useTheme();
  const palette = theme === "dark" ? colors.dark : colors.light;
  return { ...palette, radius: colors.radius };
}
