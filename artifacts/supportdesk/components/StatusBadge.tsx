import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

type Status = "open" | "in-progress" | "resolved";

// Deep Space Command — status color tokens
const STATUS_CONFIG: Record<Status, {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: keyof typeof Feather.glyphMap;
}> = {
  "open":        { label: "Open",        bg: "rgba(47,128,237,0.13)",  text: "#5AAEFF", border: "rgba(47,128,237,0.35)",  icon: "circle" },
  "in-progress": { label: "In Progress", bg: "rgba(245,158,11,0.13)",  text: "#FCD34D", border: "rgba(245,158,11,0.35)", icon: "clock"  },
  "resolved":    { label: "Resolved",    bg: "rgba(0,212,170,0.13)",   text: "#00D4AA", border: "rgba(0,212,170,0.35)",  icon: "check-circle" },
};

interface StatusBadgeProps {
  status: Status;
  /** "sm" renders a compact pill (default), "md" renders a slightly larger one */
  size?: "sm" | "md";
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["open"];
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.65)).current;
  const rotateAnim  = useRef(new Animated.Value(0)).current;

  // open — pulsing dot animation
  useEffect(() => {
    if (status !== "open") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim,    { toValue: 1.6, duration: 950, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0,   duration: 950, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim,    { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.65, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  // in-progress — slow rotating dash (visual only on native via opacity wave)
  useEffect(() => {
    if (status !== "in-progress") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  const isLg = size === "md";
  const iconSize = isLg ? 12 : 10;
  const fontSize = isLg ? 12 : 11;

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <View style={[
      styles.badge,
      {
        backgroundColor: config.bg,
        borderColor: config.border,
        paddingHorizontal: isLg ? 11 : 9,
        paddingVertical:   isLg ? 5  : 4,
        borderRadius: isLg ? 8 : 6,
      },
    ]}>
      {status === "open" ? (
        <View style={styles.dotWrapper}>
          <Animated.View
            style={[
              styles.dotPulse,
              { backgroundColor: config.text, transform: [{ scale: pulseAnim }], opacity: pulseOpacity },
            ]}
          />
          <View style={[styles.dotCore, { backgroundColor: config.text }]} />
        </View>
      ) : status === "in-progress" ? (
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Feather name="clock" size={iconSize} color={config.text} />
        </Animated.View>
      ) : (
        <Feather name="check-circle" size={iconSize} color={config.text} />
      )}
      <Text style={[styles.label, { color: config.text, fontSize }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: { fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2 },
  dotWrapper: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  dotPulse:   { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  dotCore:    { width: 6, height: 6, borderRadius: 3 },
});

