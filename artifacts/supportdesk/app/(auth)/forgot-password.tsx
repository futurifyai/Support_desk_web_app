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
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRequestPasswordReset } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const resetMutation = useRequestPasswordReset();
  const s = makeStyles(colors, isDark);

  async function handleSubmit() {
    setError("");
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address");
      return;
    }
    try {
      await resetMutation.mutateAsync({ data: { email: email.trim() } });
      setSuccess(true);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(anyErr?.response?.data?.message ?? anyErr?.message ?? "Request failed. Please try again.");
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
          <Text style={s.backText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={s.iconCircle}>
          <Feather name="lock" size={24} color="#FFFFFF" />
        </View>

        <Text style={s.title}>Forgot Password?</Text>
        <Text style={s.subtitle}>
          Enter your email and we'll send you a link to reset your password.
        </Text>

        <View style={s.card}>
          {success ? (
            <View style={s.successBox}>
              <Feather name="check-circle" size={32} color={colors.success ?? "#22C55E"} />
              <Text style={s.successTitle}>Check your inbox</Text>
              <Text style={s.successText}>
                If an account exists for <Text style={{ fontFamily: "Inter_600SemiBold" }}>{email.trim()}</Text>, you'll receive a password reset email shortly.
              </Text>
              <TouchableOpacity style={s.btn} onPress={() => router.back()} activeOpacity={0.85}>
                <Text style={s.btnText}>Back to Sign In</Text>
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

              <View style={s.fieldGroup}>
                <Text style={s.label}>Email address</Text>
                <TextInput
                  style={[s.input, focused && s.inputFocused]}
                  placeholder="you@company.com"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setError(""); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="send"
                  onSubmitEditing={handleSubmit}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />
              </View>

              <TouchableOpacity
                style={[s.btn, resetMutation.isPending && { opacity: 0.6 }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={resetMutation.isPending}
              >
                {resetMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.btnText}>Send Reset Link</Text>}
              </TouchableOpacity>

              <TouchableOpacity style={s.cancelRow} onPress={() => router.back()} activeOpacity={0.7}>
                <Text style={s.cancelText}>Remember your password? <Text style={s.cancelLink}>Sign in</Text></Text>
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
    fieldGroup: { marginBottom: 18 },
    label: { fontSize: 13, fontWeight: "500" as const, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 7 },
    input: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    inputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.04"})` },
    btn: {
      backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 14,
      alignItems: "center",
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
    },
    btnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    cancelRow: { alignItems: "center", marginTop: 16 },
    cancelText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    cancelLink: { color: colors.primary, fontFamily: "Inter_600SemiBold" },
    successBox: { alignItems: "center", gap: 12 },
    successTitle: { fontSize: 20, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    successText: {
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground,
      textAlign: "center", lineHeight: 21,
    },
  });
}
