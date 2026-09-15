// ─── Deep Space Command — Design System ────────────────────────────────────
// A premium enterprise dark-mode design language for SupportDesk.
// Electric blue primary · Cyan-green success · Deep navy surfaces
// ────────────────────────────────────────────────────────────────────────────

const colors = {
  light: {
    text: "#0D1B2A",
    tint: "#2F80ED",

    background: "#EEF4FB",
    foreground: "#0D1B2A",

    card: "#FFFFFF",
    cardForeground: "#0D1B2A",

    primary: "#2F80ED",
    primaryForeground: "#FFFFFF",

    secondary: "#E0ECFB",
    secondaryForeground: "#1A3A5C",

    muted: "#E4EDF7",
    mutedForeground: "#5A7A99",

    accent: "#2F80ED",
    accentForeground: "#FFFFFF",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    success: "#00C49A",
    warning: "#F59E0B",
    info: "#60A5FA",

    border: "#C8DCF0",
    input: "#E0ECFB",
  },

  dark: {
    // Backgrounds — layered navy depth
    text: "#E8F0FE",
    tint: "#3B9EFF",

    background: "#060E1E",    // base — deepest navy
    foreground: "#E8F0FE",

    card: "#0B1629",           // surface — slightly lifted
    cardForeground: "#E8F0FE",

    primary: "#2F80ED",        // electric blue
    primaryForeground: "#FFFFFF",

    secondary: "#0F1E35",      // raised panel bg
    secondaryForeground: "#8AA3C8",

    muted: "#162036",          // inputs / subtle bg
    mutedForeground: "#5A7A9B",

    accent: "#3B9EFF",         // hover / highlight accent
    accentForeground: "#FFFFFF",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    success: "#00D4AA",        // cyan-green for resolved/approved
    warning: "#F59E0B",        // amber for SLA warnings
    info: "#60A5FA",           // soft blue for info

    border: "rgba(255,255,255,0.07)",
    borderHi: "rgba(47,128,237,0.35)",   // focused-input border
    input: "#0F1E35",
  },

  // Shared semantic values used across both themes
  priority: {
    critical: "#EF4444",
    high:     "#F97316",
    medium:   "#2F80ED",
    low:      "#445672",
  },

  // Glow/shadow presets for the dark mode cards
  glow: {
    primary: "rgba(47,128,237,0.28)",
    success: "rgba(0,212,170,0.22)",
    warning: "rgba(245,158,11,0.22)",
    destructive: "rgba(239,68,68,0.22)",
  },

  radius: 14,
  radiusSm: 8,
  radiusLg: 20,
};


export default colors;
