import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useConfirmPasswordReset } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();

  const [token, setToken] = useState(params.token ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const resetMutation = useConfirmPasswordReset();
  const s = makeStyles(colors, isDark);

  async function handleSubmit() {
    setError("");
    if (!token.trim()) {
      setError("Please enter the reset token from your email");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    try {
      await resetMutation.mutateAsync({ data: { token: token.trim(), password } });
      setSuccess(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(anyErr?.response?.data?.message ?? anyErr?.message ?? "Reset failed. The link may have expired.");
    }
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <View style={s.iconCircle}>
          <Feather name="shield" size={24} color="#FFFFFF" />
        </View>

        <Text style={s.title}>Set New Password</Text>
        <Text style={s.subtitle}>
          Enter the token from your email and choose a new password.
        </Text>

        <View style={s.card}>
          {success ? (
            <View style={s.successBox}>
              <Feather name="check-circle" size={32} color="#22C55E" />
              <Text style={s.successTitle}>Password updated!</Text>
              <Text style={s.successText}>
                Your password has been reset successfully. You can now sign in with your new password.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => router.replace("/(auth)/login")} activeOpacity={0.85}>
                <Text style={s.btnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {error ? (
                <View style={s.errorBox}>
                  <Feather name="alert-circle" size={13} color={colors.destructive} />
                  <Text style={s.errorText}>{error}</Text>
                </View>
              ) : null}

              {!params.token && (
                <View style={s.fieldGroup}>
                  <Text style={s.label}>Reset Token</Text>
                  <TextInput
                    style={[s.input, focused === "token" && s.inputFocused]}
                    placeholder="Paste token from email"
                    placeholderTextColor={colors.mutedForeground}
                    value={token}
                    onChangeText={(t) => { setToken(t); setError(""); }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    onFocus={() => setFocused("token")}
                    onBlur={() => setFocused(null)}
                  />
                </View>
              )}

              <View style={s.fieldGroup}>
                <Text style={s.label}>New Password</Text>
                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, s.passwordInput, focused === "password" && s.inputFocused]}
                    placeholder="At least 8 characters"
                    placeholderTextColor={colors.mutedForeground}
                    value={password}
                    onChangeText={(t) => { setPassword(t); setError(""); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                    onFocus={() => setFocused("password")}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                    <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.fieldGroup}>
                <Text style={s.label}>Confirm Password</Text>
                <View style={s.passwordRow}>
                  <TextInput
                    style={[s.input, s.passwordInput, focused === "confirm" && s.inputFocused]}
                    placeholder="Repeat your new password"
                    placeholderTextColor={colors.mutedForeground}
                    value={confirmPassword}
                    onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
                    secureTextEntry={!showConfirm}
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                    onFocus={() => setFocused("confirm")}
                    onBlur={() => setFocused(null)}
                  />
                  <TouchableOpacity style={s.eyeBtn} onPress={() => setShowConfirm(!showConfirm)}>
                    <Feather name={showConfirm ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[s.btn, resetMutation.isPending && { opacity: 0.6 }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: {
      flexGrow: 1, paddingHorizontal: 24,
      justifyContent: "center", maxWidth: 440, alignSelf: "center", width: "100%",
    },
    backBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 32 },
    backText: { fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground },
    iconCircle: {
      width: 64, height: 64, borderRadius: 18, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center", marginBottom: 20, alignSelf: "center",
    },
    title: {
      fontSize: 26, fontWeight: "700" as const, fontFamily: "Inter_700Bold",
      color: colors.foreground, textAlign: "center", marginBottom: 8,
    },
    subtitle: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
      textAlign: "center", lineHeight: 21, marginBottom: 28,
    },
    card: {
      backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 28,
      ...(isDark ? {} : { shadowColor: "#334155", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.13, shadowRadius: 18, elevation: 3 }),
    },
    errorBox: {
      flexDirection: "row", alignItems: "center", gap: 8,
      backgroundColor: `rgba(239,68,68,${isDark ? "0.1" : "0.07"})`,
      borderWidth: 1, borderColor: "rgba(239,68,68,0.25)", borderRadius: 8, padding: 12, marginBottom: 18,
    },
    errorText: { color: colors.destructive, fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
    fieldGroup: { marginBottom: 16 },
    label: { fontSize: 13, fontWeight: "500" as const, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 7 },
    input: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    inputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.04"})` },
    passwordRow: { position: "relative" },
    passwordInput: { paddingRight: 46 },
    eyeBtn: { position: "absolute", right: 13, top: 0, bottom: 0, justifyContent: "center" },
    btn: {
      backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14,
      alignItems: "center", marginTop: 6,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
    },
    btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    successBox: { alignItems: "center", gap: 12 },
    successTitle: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    successText: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
      textAlign: "center", lineHeight: 21,
    },
  });
}
