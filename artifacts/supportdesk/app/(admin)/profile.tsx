import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetProfileQueryKey,
  useGetProfile,
  useUpdateProfile,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import AdminHeader, { AdminHeaderIconButton } from "@/components/AdminHeader";
import BottomNav, { NavTab } from "@/components/BottomNav";

const ADMIN_TABS: NavTab[] = [
  { key: "dashboard", label: "Tickets", icon: "grid", iconActive: "grid" },
  { key: "analytics", label: "Analytics", icon: "bar-chart-2", iconActive: "bar-chart-2" },
  { key: "user-stats", label: "Users", icon: "users", iconActive: "users" },
  { key: "access", label: "Access", icon: "key", iconActive: "key" },
  { key: "audit-log", label: "Audit", icon: "shield", iconActive: "shield" },
];

export default function AdminProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const { user, login, logout, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: profileData, isLoading } = useGetProfile();
  const profile = profileData?.data;
  const updateMutation = useUpdateProfile();

  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (profile?.name) setName(profile.name);
  }, [profile?.name]);

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleSave() {
    setError("");
    setSuccess("");
    if (name.trim().length < 2) {
      setError("Name must be at least 2 characters.");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword && !currentPassword) {
      setError("Enter your current password to set a new one.");
      return;
    }

    const data: { name?: string; currentPassword?: string; newPassword?: string } = {};
    if (name.trim() !== profile?.name) data.name = name.trim();
    if (newPassword) {
      data.currentPassword = currentPassword;
      data.newPassword = newPassword;
    }
    if (!Object.keys(data).length) {
      setSuccess("No changes to save.");
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({ data });
      await queryClient.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      if (result.data) {
        const refreshedUser = {
          id: result.data.id,
          name: result.data.name,
          email: result.data.email,
          role: result.data.role,
        };
        if (result.data.token) await login(result.data.token, refreshedUser);
        else await updateUser(refreshedUser);
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Admin profile updated successfully.");
    } catch (err: unknown) {
      const response = err as { response?: { data?: { message?: string } }; message?: string };
      setError(response.response?.data?.message ?? response.message ?? "Unable to update profile.");
    }
  }

  function handleLogout() {
    if (Platform.OS === "web") logout();
    else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: logout },
      ]);
    }
  }

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <AdminHeader
        title="Admin Profile"
        showAccountActions={false}
        leadingAction={
          <AdminHeaderIconButton
            icon="arrow-left"
            accessibilityLabel="Go back"
            onPress={() => router.back()}
          />
        }
      />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.identityCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(profile?.name ?? user?.name ?? "A")[0].toUpperCase()}</Text>
          </View>
          <View style={s.identityCopy}>
            <Text style={s.name}>{profile?.name ?? user?.name ?? "Admin"}</Text>
            <Text style={s.email}>{profile?.email ?? user?.email ?? "—"}</Text>
            <View style={s.roleBadge}>
              <Feather name="shield" size={11} color={colors.primary} />
              <Text style={s.roleText}>Administrator</Text>
            </View>
          </View>
          <View style={s.statusDot} />
        </View>

        {isLoading ? (
          <View style={s.loading}><ActivityIndicator color={colors.primary} /><Text style={s.muted}>Loading profile…</Text></View>
        ) : (
          <>
            {error ? <View style={s.messageError}><Feather name="alert-circle" size={15} color={colors.destructive} /><Text style={s.errorText}>{error}</Text></View> : null}
            {success ? <View style={s.messageSuccess}><Feather name="check-circle" size={15} color={colors.success} /><Text style={s.successText}>{success}</Text></View> : null}

            <View style={s.section}>
              <Text style={s.sectionLabel}>Account details</Text>
              <View style={s.card}>
                <Text style={s.label}>Full name</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, focused === "name" && s.inputFocused]}
                  onFocus={() => setFocused("name")}
                  onBlur={() => setFocused(null)}
                />
                <Text style={s.label}>Email address</Text>
                <View style={[s.input, s.disabledInput]}><Text style={s.disabledText}>{profile?.email ?? user?.email ?? "—"}</Text></View>
                <Text style={s.hint}>Email is managed by your account and cannot be changed.</Text>
              </View>
            </View>

            <View style={s.section}>
              <Text style={s.sectionLabel}>Security</Text>
              <View style={s.card}>
                <Text style={s.cardIntro}>Update your password to keep the admin account secure.</Text>
                <PasswordField label="Current password" value={currentPassword} onChangeText={setCurrentPassword} visible={showCurrent} onToggle={() => setShowCurrent(!showCurrent)} focused={focused === "current"} onFocus={() => setFocused("current")} onBlur={() => setFocused(null)} placeholder="Enter current password" styles={s} colors={colors} />
                <PasswordField label="New password" value={newPassword} onChangeText={setNewPassword} visible={showNew} onToggle={() => setShowNew(!showNew)} focused={focused === "new"} onFocus={() => setFocused("new")} onBlur={() => setFocused(null)} placeholder="At least 8 characters" styles={s} colors={colors} />
                <Text style={s.label}>Confirm new password</Text>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Repeat new password"
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, focused === "confirm" && s.inputFocused]}
                  onFocus={() => setFocused("confirm")}
                  onBlur={() => setFocused(null)}
                />
              </View>
            </View>

            <TouchableOpacity style={[s.saveButton, updateMutation.isPending && { opacity: 0.6 }]} onPress={() => void handleSave()} disabled={updateMutation.isPending} activeOpacity={0.85}>
              {updateMutation.isPending ? <ActivityIndicator color="#fff" /> : <><Feather name="save" size={16} color="#fff" /><Text style={s.saveText}>Save changes</Text></>}
            </TouchableOpacity>

            <TouchableOpacity style={s.signOut} onPress={handleLogout} activeOpacity={0.8}>
              <View style={s.signOutIcon}><Feather name="log-out" size={15} color={colors.destructive} /></View>
              <View style={{ flex: 1 }}><Text style={s.signOutTitle}>Sign out</Text><Text style={s.muted}>End this admin session</Text></View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      <BottomNav
        tabs={ADMIN_TABS}
        activeKey=""
        onPress={(key) => {
          if (key === "dashboard") router.navigate("/(admin)/dashboard" as never);
          if (key === "analytics") router.navigate("/(admin)/analytics" as never);
          if (key === "user-stats") router.navigate("/(admin)/user-stats" as never);
          if (key === "access") router.navigate("/(admin)/access" as never);
          if (key === "audit-log") router.navigate("/(admin)/audit-log" as never);
        }}
      />
    </View>
  );
}

function PasswordField({ label, value, onChangeText, visible, onToggle, focused, onFocus, onBlur, placeholder, styles, colors }: {
  label: string; value: string; onChangeText: (value: string) => void; visible: boolean; onToggle: () => void;
  focused: boolean; onFocus: () => void; onBlur: () => void; placeholder: string;
  styles: ReturnType<typeof makeStyles>; colors: ReturnType<typeof useColors>;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.passwordRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={!visible}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, styles.passwordInput, focused && styles.inputFocused]}
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <TouchableOpacity style={styles.eyeButton} onPress={onToggle} hitSlop={8}>
          <Feather name={visible ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 18 },
    identityCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 17, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16 },
    avatar: { width: 58, height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary },
    avatarText: { fontSize: 25, fontFamily: "Inter_700Bold", color: "#fff" },
    identityCopy: { flex: 1, gap: 3 },
    name: { fontSize: 18, fontFamily: "Inter_700Bold", color: colors.foreground },
    email: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", marginTop: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, backgroundColor: isDark ? "rgba(99,102,241,0.18)" : "rgba(99,102,241,0.1)" },
    roleText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary },
    statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.success, alignSelf: "flex-start" },
    section: { gap: 8 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_700Bold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.7, paddingHorizontal: 2 },
    card: { padding: 17, gap: 0, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
    cardIntro: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 16 },
    label: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 7 },
    input: { height: 46, paddingHorizontal: 13, paddingVertical: 0, marginBottom: 15, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.input, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground },
    inputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: isDark ? "rgba(99,102,241,0.08)" : "rgba(99,102,241,0.04)" },
    disabledInput: { justifyContent: "center", backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)" },
    disabledText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    hint: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: -8, marginBottom: 2 },
    passwordRow: { position: "relative" },
    passwordInput: { paddingRight: 45 },
    eyeButton: { position: "absolute", right: 13, top: 0, height: 46, justifyContent: "center" },
    saveButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 11, backgroundColor: colors.primary, shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
    saveText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
    signOut: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: isDark ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.18)", backgroundColor: isDark ? "rgba(239,68,68,0.06)" : "rgba(239,68,68,0.03)", borderRadius: 13 },
    signOutIcon: { width: 35, height: 35, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)" },
    signOutTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.destructive },
    muted: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    loading: { alignItems: "center", gap: 10, paddingVertical: 44 },
    messageError: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)" },
    messageSuccess: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(34,197,94,0.25)", backgroundColor: "rgba(34,197,94,0.08)" },
    errorText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: colors.destructive },
    successText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: colors.success },
  });
}