import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetProfile,
  useUpdateProfile,
  getGetProfileQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav, { NavTab } from "@/components/BottomNav";

const USER_TABS: NavTab[] = [
  { key: "index",   label: "New Ticket", icon: "plus-circle", iconActive: "plus-circle" },
  { key: "history", label: "My Tickets", icon: "list",        iconActive: "list"        },
  { key: "satisfaction", label: "Satisfaction", icon: "star", iconActive: "star" },
];

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, login, logout, updateUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: profileData, isLoading } = useGetProfile();
  const profile = profileData?.data;

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState("");

  const updateMutation = useUpdateProfile();

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile]);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function validateProfile(): boolean {
    const e: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) {
      e.name = "Name must be at least 2 characters";
    }
    if (newPassword && newPassword.length < 8) {
      e.newPassword = "New password must be at least 8 characters";
    }
    if (newPassword && newPassword !== confirmPassword) {
      e.confirmPassword = "Passwords do not match";
    }
    if (newPassword && !currentPassword) {
      e.currentPassword = "Current password is required to set a new one";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    setSuccessMsg("");
    if (!validateProfile()) return;
    try {
      const payload: { name?: string; currentPassword?: string; newPassword?: string } = {};
      if (name.trim() !== profile?.name) payload.name = name.trim();
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }
      if (Object.keys(payload).length === 0) {
        setSuccessMsg("No changes to save.");
        return;
      }
      const result = await updateMutation.mutateAsync({ data: payload });
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      if (result.data) {
        const refreshedUser = {
          id: result.data.id,
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
        };
        if (result.data.token) {
          await login(result.data.token, refreshedUser);
        } else {
          await updateUser(refreshedUser);
        }
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccessMsg("Profile updated successfully!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setErrors({ general: anyErr?.response?.data?.message ?? anyErr?.message ?? "Update failed" });
    }
  }

  function handleLogout() {
    if (Platform.OS === "web") {
      logout();
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout },
      ]);
    }
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={[s.header, BLUR]}>
        <View>
          <Text style={s.headerTitle}>Profile</Text>
          <Text style={s.headerSub}>Manage your account settings</Text>
        </View>
        <View style={s.headerActions}>
          <ThemeToggle size={36} />
          <TouchableOpacity style={s.iconBtn} onPress={() => router.navigate("/(tabs)/help" as never)}>
            <Feather name="help-circle" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar / info banner */}
        <View style={s.avatarCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarInitial}>
              {(profile?.name ?? user?.name ?? "U")[0].toUpperCase()}
            </Text>
          </View>
          <View style={s.avatarInfo}>
            <Text style={s.avatarName}>{profile?.name ?? user?.name ?? "—"}</Text>
            <Text style={s.avatarEmail}>{profile?.email ?? user?.email ?? "—"}</Text>
            <View style={s.roleBadge}>
              <Text style={s.roleText}>{profile?.role ?? user?.role ?? "user"}</Text>
            </View>
          </View>
        </View>

        {isLoading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color={colors.primary} />
            <Text style={s.loadingText}>Loading profile…</Text>
          </View>
        ) : (
          <>
            {/* Success / Error banners */}
            {successMsg ? (
              <View style={s.successBox}>
                <Feather name="check-circle" size={14} color="#22C55E" />
                <Text style={s.successText}>{successMsg}</Text>
              </View>
            ) : null}
            {errors.general ? (
              <View style={s.errorBox}>
                <Feather name="alert-circle" size={13} color={colors.destructive} />
                <Text style={s.errorText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Profile info */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Account Information</Text>
              <View style={s.card}>
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Full Name</Text>
                  <TextInput
                    style={[s.input, focused === "name" && s.inputFocused, errors.name && s.inputError]}
                    value={name}
                    onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: undefined as unknown as string })); }}
                    placeholder="Your full name"
                    placeholderTextColor={colors.mutedForeground}
                    returnKeyType="done"
                    onFocus={() => setFocused("name")}
                    onBlur={() => setFocused(null)}
                  />
                  {errors.name ? <Text style={s.fieldError}>{errors.name}</Text> : null}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Email address</Text>
                  <View style={[s.input, s.disabledInput]}>
                    <Text style={s.disabledText}>{profile?.email ?? user?.email ?? "—"}</Text>
                  </View>
                  <Text style={s.hint}>Email cannot be changed</Text>
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Member since</Text>
                  <View style={[s.input, s.disabledInput]}>
                    <Text style={s.disabledText}>
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                        : "—"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Change password */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Change Password</Text>
              <View style={s.card}>
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Current Password</Text>
                  <View style={s.passwordRow}>
                    <TextInput
                      style={[s.input, s.passwordInput, focused === "current" && s.inputFocused, errors.currentPassword && s.inputError]}
                      placeholder="Enter current password"
                      placeholderTextColor={colors.mutedForeground}
                      value={currentPassword}
                      onChangeText={(t) => { setCurrentPassword(t); setErrors((e) => ({ ...e, currentPassword: undefined as unknown as string })); }}
                      secureTextEntry={!showCurrent}
                      onFocus={() => setFocused("current")}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowCurrent(!showCurrent)}>
                      <Feather name={showCurrent ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  {errors.currentPassword ? <Text style={s.fieldError}>{errors.currentPassword}</Text> : null}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>New Password</Text>
                  <View style={s.passwordRow}>
                    <TextInput
                      style={[s.input, s.passwordInput, focused === "new" && s.inputFocused, errors.newPassword && s.inputError]}
                      placeholder="At least 8 characters"
                      placeholderTextColor={colors.mutedForeground}
                      value={newPassword}
                      onChangeText={(t) => { setNewPassword(t); setErrors((e) => ({ ...e, newPassword: undefined as unknown as string })); }}
                      secureTextEntry={!showNew}
                      onFocus={() => setFocused("new")}
                      onBlur={() => setFocused(null)}
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowNew(!showNew)}>
                      <Feather name={showNew ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                    </TouchableOpacity>
                  </View>
                  {errors.newPassword ? <Text style={s.fieldError}>{errors.newPassword}</Text> : null}
                </View>

                <View style={s.fieldGroup}>
                  <Text style={s.label}>Confirm New Password</Text>
                  <TextInput
                    style={[s.input, focused === "confirm" && s.inputFocused, errors.confirmPassword && s.inputError]}
                    placeholder="Repeat new password"
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: undefined as unknown as string })); }}
                    secureTextEntry
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused(null)}
                  />
                  {errors.confirmPassword ? <Text style={s.fieldError}>{errors.confirmPassword}</Text> : null}
                </View>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[s.saveBtn, updateMutation.isPending && { opacity: 0.6 }]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : (
                  <>
                    <Feather name="save" size={15} color="#fff" />
                    <Text style={s.saveBtnText}>Save Changes</Text>
                  </>
                )}
            </TouchableOpacity>

            {/* Danger zone */}
            <View style={s.section}>
              <Text style={s.sectionTitle}>Account Actions</Text>
              <View style={s.card}>
                <TouchableOpacity style={s.dangerRow} onPress={handleLogout} activeOpacity={0.75}>
                  <View style={s.dangerIcon}>
                    <Feather name="log-out" size={15} color={colors.destructive} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dangerLabel}>Sign Out</Text>
                    <Text style={s.dangerSub}>You'll need to sign in again to access your tickets</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomNav
        tabs={USER_TABS}
        activeKey=""
        onPress={(key) => {
          if (key === "index") router.navigate("/(tabs)/" as never);
          else if (key === "history") router.navigate("/(tabs)/history" as never);
          else if (key === "satisfaction") router.navigate("/(tabs)/satisfaction" as never);
        }}
      />
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      paddingHorizontal: 20, paddingVertical: 15,
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(248,250,252,0.95)",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 19, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    headerActions: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 36, height: 36, borderRadius: 10, backgroundColor: colors.secondary,
      borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center",
    },
    scroll: { flex: 1 },
    scrollContent: { padding: 16, gap: 14 },
    avatarCard: {
      flexDirection: "row", alignItems: "center", gap: 16,
      backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      padding: 18,
    },
    avatarCircle: {
      width: 56, height: 56, borderRadius: 28,
      backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    },
    avatarInitial: { fontSize: 24, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: "#fff" },
    avatarInfo: { flex: 1, gap: 3 },
    avatarName: { fontSize: 17, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    avatarEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    roleBadge: {
      alignSelf: "flex-start", marginTop: 4,
      paddingHorizontal: 8, paddingVertical: 2,
      borderRadius: 6, backgroundColor: `rgba(99,102,241,${isDark ? "0.2" : "0.1"})`,
    },
    roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary, textTransform: "capitalize" },
    loadingBox: { alignItems: "center", paddingVertical: 40, gap: 10 },
    loadingText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    successBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: "rgba(34,197,94,0.1)", borderWidth: 1, borderColor: "rgba(34,197,94,0.3)",
      borderRadius: 8, padding: 12,
    },
    successText: { color: "#22C55E", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
    errorBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: `rgba(239,68,68,${isDark ? "0.1" : "0.07"})`,
      borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", borderRadius: 8, padding: 12,
    },
    errorText: { color: colors.destructive, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
    section: { gap: 8 },
    sectionTitle: {
      fontSize: 12, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.5,
      paddingHorizontal: 2,
    },
    card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 0 },
    fieldGroup: { marginBottom: 14 },
    label: { fontSize: 13, fontWeight: "500" as const, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 7 },
    input: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    inputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.04"})` },
    inputError: { borderColor: colors.destructive },
    disabledInput: {
      justifyContent: "center", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
    },
    disabledText: { fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    hint: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 4 },
    fieldError: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.destructive, marginTop: 4 },
    passwordRow: { position: "relative" },
    passwordInput: { paddingRight: 46 },
    eyeBtn: { position: "absolute", right: 13, top: 0, bottom: 0, justifyContent: "center" },
    saveBtn: {
      flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
      backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
    },
    saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    dangerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    dangerIcon: {
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: `rgba(239,68,68,${isDark ? "0.12" : "0.08"})`,
      alignItems: "center", justifyContent: "center",
    },
    dangerLabel: { fontSize: 14, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.destructive },
    dangerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
  });
}
