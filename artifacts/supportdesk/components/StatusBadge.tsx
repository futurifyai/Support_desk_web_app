import React, { useRef, useEffect } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

type Status = "open" | "in-progress" | "resolved";

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; border: string; icon: string }> = {
  "open":        { label: "Open",        bg: "rgba(99,102,241,0.15)",  text: "#A5B4FC", border: "rgba(99,102,241,0.35)",  icon: "circle" },
  "in-progress": { label: "In Progress", bg: "rgba(245,158,11,0.15)", text: "#FCD34D", border: "rgba(245,158,11,0.35)", icon: "clock" },
  "resolved":    { label: "Resolved",    bg: "rgba(34,197,94,0.15)",  text: "#4ADE80", border: "rgba(34,197,94,0.35)",  icon: "check-circle" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG["open"];
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (status !== "open") return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1.5, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulseAnim, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [status]);

  return (
    <View style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
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
      ) : (
        <Feather name={config.icon as "clock" | "check-circle"} size={10} color={config.text} />
      )}
      <Text style={[styles.label, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  label: { fontSize: 11, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  dotWrapper: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
  dotPulse: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  dotCore: { width: 6, height: 6, borderRadius: 3 },
});
