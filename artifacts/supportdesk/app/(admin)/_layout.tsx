import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";
import { Stack } from "expo-router";
import { useColors } from "@/hooks/useColors";
import AdminSidebar from "@/components/AdminSidebar";

export default function AdminLayout() {
  const colors = useColors();
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === "web" && width >= 1024;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {isDesktopWeb && <AdminSidebar />}
      <View style={styles.content}>
        <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }}>
          <Stack.Screen name="dashboard" options={{ animation: "fade" }} />
          <Stack.Screen name="analytics" options={{ animation: "fade" }} />
          <Stack.Screen name="user-stats" options={{ animation: "fade" }} />
          <Stack.Screen name="access" options={{ animation: "fade" }} />
          <Stack.Screen name="audit-log" options={{ animation: "fade" }} />
          <Stack.Screen name="profile" options={{ animation: "fade" }} />
          <Stack.Screen name="ticket/[id]" />
        </Stack>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row" },
  content: { flex: 1, minWidth: 0 },
});
