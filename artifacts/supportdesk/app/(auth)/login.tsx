import React, { useState, useRef, useEffect } from "react";
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
  Animated,
} from "react-native";
import { Link } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const colors = useColors();
  const isDark = colors.isDark;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const loginMutation = useLogin();

  // ── Entrance animations ──────────────────────────────────────────────
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY       = useRef(new Animated.Value(-20)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY       = useRef(new Animated.Value(32)).current;
  const footOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(logoY,       { toValue: 0, friction: 7, tension: 48, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 520, delay: 160, useNativeDriver: true }),
      Animated.spring(cardY,       { toValue: 0, delay: 160, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    Animated.timing(footOpacity, { toValue: 1, duration: 500, delay: 450, useNativeDriver: true }).start();
  }, []);

  async function handleLogin() {
    setError("");
    if (!email.trim())  { setError("Please enter your email");    return; }
    if (!password)      { setError("Please enter your password"); return; }
    try {
      const res = await loginMutation.mutateAsync({ data: { email: email.trim(), password } });
      if (res.data) await login(res.data.token, res.data.user);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(anyErr?.response?.data?.message ?? anyErr?.message ?? "Login failed");
    }
  }

  // ── Background gradient (web only) ──────────────────────────────────
  const bgStyle = Platform.OS === "web"
    ? ({
        backgroundImage: isDark
          ? [
              "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(47,128,237,0.20) 0%, transparent 65%)",
              "radial-gradient(ellipse 60% 40% at 85% 90%, rgba(0,212,170,0.08) 0%, transparent 55%)",
              "radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)",
            ].join(", ")
          : [
              "radial-gradient(ellipse 90% 55% at 50% -5%, rgba(47,128,237,0.13) 0%, transparent 65%)",
              "radial-gradient(circle, rgba(47,128,237,0.04) 1px, transparent 1px)",
            ].join(", "),
        backgroundSize: "100% 100%, 100% 100%, 26px 26px",
      } as object)
    : {};

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }, bgStyle,
        Platform.OS === "web" ? { paddingTop: 0 } : {}]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 56 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Logo row ────────────────────────────────────────── */}
        <Animated.View style={[styles.logoRow, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
          {/* Brand icon */}
          <View style={styles.iconWrap}>
            <View style={styles.iconGlow} />
            <View style={styles.iconCircle}>
              <Feather name="headphones" size={20} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.brandTextWrap}>
            <Text style={[styles.brandName, { color: colors.foreground }]}>SupportDesk</Text>
            <Text style={[styles.brandTag, { color: isDark ? "#3B9EFF" : colors.primary }]}>
              Enterprise Support Platform
            </Text>
          </View>
          <ThemeToggle size={36} />
        </Animated.View>

        {/* ── Headline ─────────────────────────────────────────── */}
        <Animated.View style={{ opacity: logoOpacity }}>
          <Text style={[styles.headline, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.subline, { color: isDark ? "#5A7A9B" : colors.mutedForeground }]}>
            Sign in to your workspace
          </Text>
        </Animated.View>

        {/* ── Form card ────────────────────────────────────────── */}
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "rgba(11,22,41,0.90)" : "#FFFFFF",
              borderColor: isDark ? "rgba(255,255,255,0.08)" : colors.border,
              opacity: cardOpacity,
              transform: [{ translateY: cardY }],
            },
            Platform.OS === "web" && isDark
              ? ({ boxShadow: "0 0 0 1px rgba(47,128,237,0.12), 0 24px 64px rgba(0,0,0,0.6), 0 0 120px rgba(47,128,237,0.07)" } as object)
              : Platform.OS === "web"
              ? ({ boxShadow: "0 8px 40px rgba(47,128,237,0.10), 0 2px 8px rgba(0,0,0,0.06)" } as object)
              : {},
          ]}
        >
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: isDark ? "#8AA3C8" : colors.foreground }]}>
              Email address
            </Text>
            <View style={[
              styles.inputWrap,
              {
                backgroundColor: isDark ? colors.muted : colors.input,
                borderColor: focused === "email"
                  ? colors.primary
                  : isDark ? "rgba(255,255,255,0.08)" : colors.border,
                borderWidth: focused === "email" ? 2 : 1,
              },
            ]}>
              <Feather name="mail" size={15} color={focused === "email" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                placeholder="you@company.com"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocused("email")}
                onBlur={() => setFocused(null)}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: isDark ? "#8AA3C8" : colors.foreground }]}>
                Password
              </Text>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity activeOpacity={0.75}>
                  <Text style={[styles.forgotLink, { color: colors.primary }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </Link>
            </View>
            <View style={[
              styles.inputWrap,
              {
                backgroundColor: isDark ? colors.muted : colors.input,
                borderColor: focused === "password"
                  ? colors.primary
                  : isDark ? "rgba(255,255,255,0.08)" : colors.border,
                borderWidth: focused === "password" ? 2 : 1,
              },
            ]}>
              <Feather name="lock" size={15} color={focused === "password" ? colors.primary : colors.mutedForeground} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.passwordInput, { color: colors.foreground }]}
                placeholder="••••••••"
                placeholderTextColor={colors.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocused("password")}
                onBlur={() => setFocused(null)}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Feather
                  name={showPassword ? "eye-off" : "eye"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={[
              styles.btn,
              loginMutation.isPending && { opacity: 0.65 },
              Platform.OS === "web"
                ? ({ background: "linear-gradient(135deg, #2F80ED 0%, #5AA5FF 100%)" } as object)
                : { backgroundColor: "#2F80ED" },
            ]}
            onPress={handleLogin}
            activeOpacity={0.82}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : (
                <>
                  <Text style={styles.btnText}>Sign In</Text>
                  <Feather name="arrow-right" size={16} color="#FFFFFF" />
                </>
              )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={[styles.divider, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : colors.border }]}>
            <Text style={[styles.dividerText, { color: isDark ? "#445672" : colors.mutedForeground }]}>
              Admin-provisioned accounts only
            </Text>
          </View>
        </Animated.View>

        {/* ── Footer trust bar ─────────────────────────────────── */}
        <Animated.View style={[styles.trustRow, { opacity: footOpacity }]}>
          <Feather name="lock" size={11} color={isDark ? "#445672" : colors.mutedForeground} />
          <Text style={[styles.trustText, { color: isDark ? "#445672" : colors.mutedForeground }]}>
            End-to-end encrypted ·
          </Text>
          <Link href="/privacy-policy" asChild>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={[styles.privacyLink, { color: colors.primary }]}>Privacy Policy</Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    maxWidth: 460,
    alignSelf: "center",
    width: "100%",
  },

  // Logo
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  iconWrap: { position: "relative", width: 48, height: 48 },
  iconGlow: {
    position: "absolute",
    width: 48, height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(47,128,237,0.28)",
    transform: [{ scale: 1.4 }],
  },
  iconCircle: {
    width: 48, height: 48,
    borderRadius: 14,
    backgroundColor: "#2F80ED",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  brandTextWrap: { flex: 1 },
  brandName: {
    fontSize: 22,
    fontWeight: "700" as const,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  brandTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
    marginTop: 1,
  },

  // Headline
  headline: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.6,
    marginBottom: 5,
    lineHeight: 36,
  },
  subline: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
    lineHeight: 22,
  },

  // Card
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
    marginBottom: 20,
  },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.28)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },

  // Fields
  fieldGroup: { marginBottom: 16 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  forgotLink: { fontSize: 13, fontFamily: "Inter_500Medium" },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    overflow: "hidden",
  },
  inputIcon: { paddingLeft: 14 },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  passwordInput: { paddingRight: 46 },
  eyeBtn: { position: "absolute", right: 14, top: 0, bottom: 0, justifyContent: "center" },

  // Button
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 11,
    paddingVertical: 15,
    marginTop: 8,
    shadowColor: "#2F80ED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.40,
    shadowRadius: 14,
    elevation: 5,
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600" as const,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },

  // Divider
  divider: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    alignItems: "center",
  },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  // Trust row
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
  },
  trustText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  privacyLink: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
