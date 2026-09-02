import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useCreateTicket, useUploadTicketAttachment, useGetSuggestedArticles, useGetMyProducts, type HelpArticle, type UserProduct } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetTicketsQueryKey } from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useColors } from "@/hooks/useColors";
import ThemeToggle from "@/components/ThemeToggle";
import BottomNav, { NavTab } from "@/components/BottomNav";

const USER_TABS: NavTab[] = [
  { key: "index",   label: "New Ticket", icon: "plus-circle", iconActive: "plus-circle" },
  { key: "history", label: "My Tickets", icon: "list",        iconActive: "list"        },
  { key: "satisfaction", label: "Satisfaction", icon: "star", iconActive: "star" },
];

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

export default function NewTicketScreen() {
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const queryClient = useQueryClient();

  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [category, setCategory] = useState<"bug" | "feature" | "billing" | "account" | "other">("other");
  const [errors, setErrors] = useState<{ productName?: string; description?: string }>({});
  const [successVisible, setSuccessVisible] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<{ base64Data: string; fileName: string; mimeType: string; fileSize: number } | null>(null);
  const [suggestQuery, setSuggestQuery] = useState("");

  const successOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const contentY = useRef(new Animated.Value(0)).current;
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createMutation = useCreateTicket();
  const uploadMutation = useUploadTicketAttachment();
  const { data: productsData, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useGetMyProducts();
  const approvedProducts = (productsData?.data ?? []) as UserProduct[];

  const suggestEnabled = suggestQuery.length >= 40;
  const { data: suggestionsData } = useGetSuggestedArticles(
    suggestEnabled ? { category } : undefined
  );

  useEffect(() => {
    if (productName && !approvedProducts.some((product) => product.productName === productName)) {
      setProductName("");
    }
  }, [approvedProducts, productName]);

  function validate(): boolean {
    const e: { productName?: string; description?: string } = {};
    if (!approvedProducts.some((product) => product.productName === productName))
      e.productName = "Choose one of your approved products";
    if (!description.trim() || description.trim().length < 10)
      e.description = "Description must be at least 10 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      const result = await createMutation.mutateAsync({
        data: { productName: productName.trim(), description: description.trim(), priority, category },
      });
      if (attachment && result.data?.id) {
        await uploadMutation.mutateAsync({ ticketId: result.data.id, data: attachment });
      }
      await queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setProductName("");
      setDescription("");
      setPriority("medium");
      setCategory("other");
      setAttachment(null);
      setErrors({});
      setSuccessVisible(true);
      Animated.sequence([
        Animated.timing(successOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(2500),
        Animated.timing(successOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => setSuccessVisible(false));
    } catch (err: unknown) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      const anyErr = err as { response?: { data?: { message?: string } } };
      setErrors({ productName: anyErr?.response?.data?.message ?? "Submission failed" });
    }
  }

  async function chooseAttachment(source: "library" | "camera") {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setErrors({ productName: `${source === "camera" ? "Camera" : "Photo library"} permission is needed to attach an image` });
      return;
    }
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.65,
      base64: true,
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const base64Data = asset.base64;
    if (!base64Data) return;
    const estimatedSize = asset.fileSize ?? Math.round(base64Data.length * 0.75);
    if (estimatedSize > 5 * 1024 * 1024) {
      setErrors({ productName: "Please choose an image under 5 MB" });
      return;
    }
    setAttachment({
      base64Data,
      fileName: asset.fileName ?? `support-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileSize: estimatedSize,
    });
  }

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.container, { paddingTop: topPad }]}>
      <View style={[s.header, BLUR]}>
        <View>
          <Text style={s.headerTitle}>Raise a Ticket</Text>
          <Text style={s.headerSub}>Hi, {user?.name?.split(" ")[0] ?? "there"}</Text>
        </View>
        <View style={s.headerActions}>
          <ThemeToggle size={36} />
          <TouchableOpacity style={s.iconBtn} onPress={() => router.navigate("/(tabs)/help" as never)}>
            <Feather name="help-circle" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.navigate("/(tabs)/profile" as never)}>
            <Feather name="user" size={15} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentY }] }}>
          <View style={s.card}>
            <Text style={s.cardTitle}>New Support Ticket</Text>
            <Text style={s.cardSub}>Fill in the details and our team will respond shortly.</Text>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Approved Product <Text style={s.required}>*</Text></Text>
              {productsLoading ? (
                <View style={s.productLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={s.productHint}>Loading your product access…</Text>
                </View>
              ) : productsError ? (
                <View style={s.emptyAccess}>
                  <Feather name="wifi-off" size={17} color={colors.destructive} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.emptyAccessTitle}>Couldn’t check product access</Text>
                    <Text style={s.emptyAccessText}>Check your connection and try again.</Text>
                  </View>
                  <TouchableOpacity onPress={() => refetchProducts()}><Text style={s.retryAccess}>Retry</Text></TouchableOpacity>
                </View>
              ) : approvedProducts.length === 0 ? (
                <View style={s.emptyAccess}>
                  <Feather name="lock" size={17} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.emptyAccessTitle}>No approved product access</Text>
                    <Text style={s.emptyAccessText}>Contact your administrator to request access before opening a ticket.</Text>
                  </View>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.productPicker}>
                  {approvedProducts.map((product) => {
                    const selected = productName === product.productName;
                    return (
                      <TouchableOpacity
                        key={product.id}
                        style={[s.productOption, selected && s.productOptionSelected, errors.productName && s.inputError]}
                        onPress={() => { setProductName(product.productName); setErrors((e) => ({ ...e, productName: undefined })); }}
                        activeOpacity={0.75}
                      >
                        <Feather name={selected ? "check-circle" : "package"} size={14} color={selected ? "#FFFFFF" : colors.primary} />
                        <Text style={[s.productOptionText, selected && s.productOptionTextSelected]}>{product.productName}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
              {errors.productName ? (
                <View style={s.fieldErrorRow}>
                  <Feather name="alert-circle" size={12} color={colors.destructive} />
                  <Text style={s.fieldError}>{errors.productName}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Attachment</Text>
              <View style={s.attachmentActions}>
                <TouchableOpacity style={s.attachmentButton} onPress={() => chooseAttachment("library")} activeOpacity={0.75}>
                  <Feather name={attachment ? "check-circle" : "image"} size={15} color={attachment ? "#22C55E" : colors.primary} />
                  <Text style={s.attachmentText}>{attachment ? attachment.fileName : "Gallery"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.cameraButton} onPress={() => chooseAttachment("camera")} activeOpacity={0.75}>
                  <Feather name="camera" size={15} color={colors.primary} />
                  <Text style={s.cameraButtonText}>Camera</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.attachmentHint}>Images are compressed before upload. Maximum 5 MB.</Text>
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Issue Description <Text style={s.required}>*</Text></Text>
              <TextInput
                style={[s.input, s.textarea, focused === "desc" && s.inputFocused, errors.description && s.inputError]}
                placeholder="Describe your issue in detail. Include steps to reproduce, expected vs actual behavior."
                placeholderTextColor={colors.mutedForeground}
                value={description}
                onChangeText={(t) => {
                  setDescription(t);
                  setErrors((e) => ({ ...e, description: undefined }));
                  if (suggestTimer.current) clearTimeout(suggestTimer.current);
                  suggestTimer.current = setTimeout(() => setSuggestQuery(t), 500);
                }}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
                maxLength={1000}
                onFocus={() => setFocused("desc")}
                onBlur={() => setFocused(null)}
              />
              <View style={s.charRow}>
                {errors.description ? (
                  <View style={s.fieldErrorRow}>
                    <Feather name="alert-circle" size={12} color={colors.destructive} />
                    <Text style={s.fieldError}>{errors.description}</Text>
                  </View>
                ) : <View />}
                <Text style={s.charCount}>{description.length} / 1000</Text>
              </View>
            </View>

            {/* Suggested help articles — non-blocking */}
            {suggestionsData?.data && suggestionsData.data.length > 0 && (
              <SuggestedArticles articles={suggestionsData.data} colors={colors} isDark={isDark} onHelpPress={() => router.navigate("/(tabs)/help" as never)} />
            )}

            <View style={s.fieldGroup}>
              <Text style={s.label}>Priority</Text>
              <View style={s.selectorRow}>
                {(["low", "medium", "high", "critical"] as const).map((p) => {
                  const cfg = { low: { color: "#64748B", label: "Low" }, medium: { color: "#EAB308", label: "Medium" }, high: { color: "#F97316", label: "High" }, critical: { color: "#EF4444", label: "Critical" } }[p];
                  const active = priority === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      onPress={() => setPriority(p)}
                      style={[s.selectorBtn, active && { borderColor: cfg.color, backgroundColor: cfg.color + "18" }]}
                      activeOpacity={0.7}
                    >
                      <View style={[s.priorityDot, { backgroundColor: cfg.color }]} />
                      <Text style={[s.selectorBtnText, active && { color: cfg.color, fontFamily: "Inter_600SemiBold" }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.fieldGroup}>
              <Text style={s.label}>Category</Text>
              <View style={s.categoryRow}>
                {(["bug", "feature", "billing", "account", "other"] as const).map((cat) => {
                  const icon = { bug: "alert-circle", feature: "star", billing: "credit-card", account: "user", other: "help-circle" }[cat] as keyof typeof Feather.glyphMap;
                  const active = category === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      onPress={() => setCategory(cat)}
                      style={[s.categoryBtn, active && s.categoryBtnActive]}
                      activeOpacity={0.7}
                    >
                      <Feather name={icon} size={12} color={active ? "#FFFFFF" : colors.mutedForeground} />
                      <Text style={[s.categoryBtnText, active && s.categoryBtnTextActive]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={s.submitRow}>
              <View style={s.submitInfo}>
                <Feather name="mail" size={13} color={colors.mutedForeground} />
                <Text style={s.submitInfoText}>Email confirmation sent</Text>
              </View>
              <TouchableOpacity
                style={[s.submitBtn, createMutation.isPending && { opacity: 0.6 }]}
                onPress={handleSubmit}
                activeOpacity={0.85}
                disabled={createMutation.isPending || uploadMutation.isPending || productsLoading || productsError || approvedProducts.length === 0}
              >
                {createMutation.isPending || uploadMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="send" size={14} color="#fff" />
                    <Text style={s.submitBtnText}>Submit Ticket</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.tipsCard}>
            <View style={s.tipsHeader}>
              <Feather name="zap" size={13} color={colors.primary} />
              <Text style={s.tipsTitle}>Tips for faster resolution</Text>
            </View>
            {[
              "Include the exact product name or version",
              "Describe what you expected vs what happened",
              "Mention any error messages you've seen",
            ].map((tip, i) => (
              <View key={i} style={s.tipRow}>
                <View style={s.tipDot} />
                <Text style={s.tipText}>{tip}</Text>
              </View>
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {successVisible && (
        <Animated.View style={[s.successToast, { opacity: successOpacity, bottom: insets.bottom + 110 }]}>
          <Feather name="check-circle" size={16} color="#22C55E" />
          <Text style={s.successText}>Ticket submitted successfully!</Text>
        </Animated.View>
      )}

      <BottomNav
        tabs={USER_TABS}
        activeKey="index"
        onPress={(key) => {
          if (key === "history") router.navigate("/(tabs)/history" as never);
          else if (key === "satisfaction") router.navigate("/(tabs)/satisfaction" as never);
        }}
      />
    </View>
  );
}

function SuggestedArticles({
  articles,
  colors,
  isDark,
  onHelpPress,
}: {
  articles: HelpArticle[];
  colors: ReturnType<typeof useColors>;
  isDark: boolean;
  onHelpPress: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const preview = articles.slice(0, 3);

  return (
    <View style={[suggestStyles.card, {
      backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.06"})`,
      borderColor: `rgba(99,102,241,${isDark ? "0.22" : "0.16"})`,
    }]}>
      <View style={suggestStyles.header}>
        <Feather name="zap" size={13} color="#6366F1" />
        <Text style={[suggestStyles.title, { color: colors.foreground }]}>Suggested answers</Text>
        <TouchableOpacity onPress={onHelpPress} activeOpacity={0.7}>
          <Text style={suggestStyles.seeAll}>See all →</Text>
        </TouchableOpacity>
      </View>
      {preview.map((a, i) => (
        <TouchableOpacity
          key={a.id}
          style={[suggestStyles.item, { borderTopColor: `rgba(99,102,241,${isDark ? "0.15" : "0.1"})` }]}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <Feather name="file-text" size={12} color="#6366F1" />
          <Text style={[suggestStyles.itemText, { color: colors.mutedForeground }]} numberOfLines={2}>{a.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const suggestStyles = StyleSheet.create({
  card: { borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  title: { flex: 1, fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
  seeAll: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6366F1" },
  item: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingTop: 10, borderTopWidth: 1, marginTop: 8 },
  itemText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

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
    card: { backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 20 },
    cardTitle: { fontSize: 17, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 4 },
    cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginBottom: 18 },
    fieldGroup: { marginBottom: 14 },
    productLoading: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
    productHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    productPicker: { gap: 8, paddingVertical: 1 },
    productOption: {
      flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10,
      borderRadius: 9, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    productOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
    productOptionText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    productOptionTextSelected: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" },
    emptyAccess: {
      flexDirection: "row", gap: 10, padding: 13, borderRadius: 10, borderWidth: 1,
      borderColor: isDark ? "rgba(99,102,241,0.34)" : "rgba(99,102,241,0.22)",
      backgroundColor: isDark ? "rgba(99,102,241,0.11)" : "rgba(99,102,241,0.06)",
    },
    emptyAccessTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground, marginBottom: 2 },
    emptyAccessText: { fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryAccess: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
    attachmentActions: { flexDirection: "row", gap: 8 },
    attachmentButton: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderStyle: "dashed", borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 13, paddingVertical: 12, backgroundColor: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.05)" },
    attachmentText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground, flex: 1 },
    cameraButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, backgroundColor: colors.secondary },
    cameraButtonText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    attachmentHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 5 },
    label: { fontSize: 13, fontWeight: "500" as const, fontFamily: "Inter_500Medium", color: colors.foreground, marginBottom: 7 },
    required: { color: colors.destructive },
    input: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: colors.foreground,
    },
    inputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.04"})` },
    inputError: { borderColor: colors.destructive },
    textarea: { minHeight: 120 },
    charRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 5 },
    fieldErrorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    fieldError: { color: colors.destructive, fontSize: 12, fontFamily: "Inter_400Regular" },
    charCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    selectorRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    selectorBtn: {
      flexDirection: "row", alignItems: "center", gap: 6,
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    priorityDot: { width: 8, height: 8, borderRadius: 4 },
    selectorBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    categoryRow: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
    categoryBtn: {
      flexDirection: "row", alignItems: "center", gap: 5,
      paddingHorizontal: 11, paddingVertical: 7, borderRadius: 8,
      borderWidth: 1, borderColor: colors.border, backgroundColor: colors.secondary,
    },
    categoryBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    categoryBtnText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    categoryBtnTextActive: { color: "#FFFFFF", fontFamily: "Inter_600SemiBold" },
    submitRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
    submitInfo: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1 },
    submitInfoText: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    submitBtn: {
      flexDirection: "row", alignItems: "center", gap: 7,
      backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 11, paddingHorizontal: 18,
      shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 4,
    },
    submitBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold" },
    tipsCard: {
      backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.06"})`,
      borderWidth: 1, borderColor: `rgba(99,102,241,${isDark ? "0.2" : "0.15"})`, borderRadius: 12, padding: 16,
    },
    tipsHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 12 },
    tipsTitle: { fontSize: 13, fontWeight: "600" as const, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    tipRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 7 },
    tipDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.primary, marginTop: 7 },
    tipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1, lineHeight: 20 },
    successToast: {
      position: "absolute", left: 16, right: 16,
      flexDirection: "row", alignItems: "center", gap: 10,
      backgroundColor: isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.1)",
      borderWidth: 1, borderColor: "rgba(34,197,94,0.3)", borderRadius: 12, padding: 14,
    },
    successText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#22C55E" },
  });
}
