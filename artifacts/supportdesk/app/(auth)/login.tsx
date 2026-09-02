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
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import ThemeToggle from "@/components/ThemeToggle";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { isDark } = useTheme();
  const colors = useColors();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [focused, setFocused] = useState<string | null>(null);

  const loginMutation = useLogin();

  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoY = useRef(new Animated.Value(-16)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardY = useRef(new Animated.Value(28)).current;
  const trustOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.spring(logoY, { toValue: 0, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(cardOpacity, { toValue: 1, duration: 500, delay: 140, useNativeDriver: true }),
      Animated.spring(cardY, { toValue: 0, delay: 140, friction: 7, tension: 50, useNativeDriver: true }),
    ]).start();
    Animated.timing(trustOpacity, { toValue: 1, duration: 500, delay: 400, useNativeDriver: true }).start();
  }, []);

  async function handleLogin() {
    setError("");
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (!password) { setError("Please enter your password"); return; }
    try {
      const res = await loginMutation.mutateAsync({ data: { email: email.trim(), password } });
      if (res.data) await login(res.data.token, res.data.user);
    } catch (err: unknown) {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      setError(anyErr?.response?.data?.message ?? anyErr?.message ?? "Login failed");
    }
  }

  const bgGlow = Platform.OS === "web"
    ? ({
        backgroundImage: isDark
          ? "radial-gradient(ellipse 80% 45% at 50% -10%, rgba(99,102,241,0.22) 0%, transparent 70%), radial-gradient(circle, rgba(148,163,184,0.06) 1px, transparent 1px)"
          : "radial-gradient(ellipse 80% 45% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%), radial-gradient(circle, rgba(99,102,241,0.04) 1px, transparent 1px)",
        backgroundSize: "100% 100%, 22px 22px",
      } as object)
    : {};

  const s = makeStyles(colors, isDark);

  return (
    <KeyboardAvoidingView
      style={[s.container, bgGlow, { paddingTop: Platform.OS === "web" ? 67 : 0 }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 48 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[s.logoRow, { opacity: logoOpacity, transform: [{ translateY: logoY }] }]}>
          <View style={s.iconCircle}>
            <Feather name="tag" size={18} color="#FFFFFF" />
          </View>
          <Text style={s.brandName}>SupportDesk</Text>
          <ThemeToggle size={34} />
        </Animated.View>

        <Animated.Text style={[s.tagline, { opacity: logoOpacity }]}>
          Sign in to your account
        </Animated.Text>

        <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
          {error ? (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={13} color={colors.destructive} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={s.fieldGroup}>
            <Text style={s.label}>Email address</Text>
            <TextInput
              style={[s.input, focused === "email" && s.inputFocused]}
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

          <View style={s.fieldGroup}>
            <View style={s.labelRow}>
              <Text style={s.label}>Password</Text>
              <Link href="/(auth)/forgot-password" asChild>
                <TouchableOpacity activeOpacity={0.75}>
                  <Text style={s.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </Link>
            </View>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput, focused === "password" && s.inputFocused]}
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
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[s.btn, loginMutation.isPending && { opacity: 0.6 }]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.btnText}>Sign In</Text>}
          </TouchableOpacity>

        </Animated.View>

        <Animated.View style={[s.trustRow, { opacity: trustOpacity }]}>
          <Feather name="lock" size={11} color={colors.mutedForeground} />
          <Text style={s.trustText}>Your privacy matters</Text>
          <Link href="/privacy-policy" asChild>
            <TouchableOpacity activeOpacity={0.75}>
              <Text style={s.privacyLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>
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
    logoRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 },
    iconCircle: {
      width: 38, height: 38, borderRadius: 10, backgroundColor: colors.primary,
      alignItems: "center", justifyContent: "center",
    },
    brandName: { fontSize: 24, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground, letterSpacing: -0.4, flex: 1 },
    tagline: { textAlign: "center", color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 28 },
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
    labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 7 },
    forgotLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.primary },
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
    trustRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 20 },
    trustText: { fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    privacyLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
  });
}
