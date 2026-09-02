import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index"   options={{ title: "New Ticket" }} />
      <Tabs.Screen name="history" options={{ title: "My Tickets" }} />
      <Tabs.Screen name="satisfaction" options={{ title: "Satisfaction" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="help"    options={{ title: "Help Center" }} />
    </Tabs>
  );
}
