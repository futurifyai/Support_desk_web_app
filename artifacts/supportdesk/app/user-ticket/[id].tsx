import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Animated,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import {
  useGetUserTicketDetail, useCreateUserTicketReply, useUploadTicketAttachment, useRateTicket,
  getGetUserTicketDetailQueryKey, getGetTicketsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import StatusBadge from "@/components/StatusBadge";

type Status = "open" | "in-progress" | "resolved";

const STATUS_BANNER: Record<Status, { color: string; bg: string; border: string; label: string }> = {
  open:          { color: "#A5B4FC", bg: "rgba(99,102,241,0.1)",  border: "rgba(99,102,241,0.25)",  label: "Open — Your ticket is being reviewed" },
  "in-progress": { color: "#FCD34D", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)", label: "In Progress — Our team is working on it" },
  resolved:      { color: "#4ADE80", bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.25)",  label: "Resolved — This ticket has been closed" },
};

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return "—"; }
}
function formatTime(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    }).format(new Date(iso));
  } catch { return "—"; }
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UserTicketDetailScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [replyText, setReplyText] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  const [sentVisible, setSentVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toastMsg, setToastMsg] = useState("Message sent! Admin has been notified.");
  const [toastSuccess, setToastSuccess] = useState(true);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [newAdminReplies, setNewAdminReplies] = useState(0);
  const sentOpacity = useRef(new Animated.Value(0)).current;
  const knownReplyCount = useRef<number | null>(null);

  const { data, isLoading, isError, isRefetching, refetch } = useGetUserTicketDetail(id ?? "");
  const ticket = data?.data;
  const replyMutation = useCreateUserTicketReply();
  const uploadMutation = useUploadTicketAttachment();
  const rateMutation = useRateTicket();

  useEffect(() => {
    if (!ticket) return;
    if (knownReplyCount.current !== null && ticket.replies.length > knownReplyCount.current) {
      const incoming = ticket.replies
        .slice(knownReplyCount.current)
        .filter((reply) => reply.authorRole === "admin").length;
      if (incoming) setNewAdminReplies((count) => count + incoming);
    }
    knownReplyCount.current = ticket.replies.length;
  }, [ticket?.replies.length]);

  useEffect(() => {
    if (!ticket || replyMutation.isPending) return;
    const interval = setInterval(() => void refetch(), 20_000);
    return () => clearInterval(interval);
  }, [ticket?.id, replyMutation.isPending, refetch]);

  function showToast(msg: string, success = true) {
    setToastMsg(msg);
    setToastSuccess(success);
    setSentVisible(true);
    Animated.sequence([
      Animated.timing(sentOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(sentOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start(() => setSentVisible(false));
  }

  async function handleSendReply() {
    if (!id || !replyText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await replyMutation.mutateAsync({ ticketId: id, data: { message: replyText.trim() } });
      setReplyText("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() }),
      ]);
      showToast("Message sent! Admin has been notified.", true);
    } catch { showToast("Failed to send message", false); }
  }

  async function handlePickImage() {
    if (!id) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        showToast("Photo library access required", false);
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
        base64: true,
        allowsEditing: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if (!asset.base64) { showToast("Could not read image data", false); return; }

      setUploading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const fileName = asset.fileName ?? `image_${Date.now()}.jpg`;
      const mimeType = asset.mimeType ?? "image/jpeg";
      const fileSize = asset.fileSize ?? Math.round(asset.base64.length * 0.75);

      await uploadMutation.mutateAsync({
        ticketId: id,
        data: { fileName, mimeType, fileSize, base64Data: asset.base64 },
      });
      await queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(id) });
      showToast("File attached successfully!", true);
    } catch { showToast("Failed to upload attachment", false); }
    finally { setUploading(false); }
  }

  async function submitRating() {
    if (!id || rating < 1) return;
    try {
      await rateMutation.mutateAsync({ ticketId: id, data: { rating, feedbackText: feedback.trim() || null } });
      await queryClient.invalidateQueries({ queryKey: getGetUserTicketDetailQueryKey(id) });
      showToast("Thanks — your feedback helps us improve.", true);
    } catch { showToast("Could not save your feedback", false); }
  }

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const statusBanner = ticket ? (STATUS_BANNER[ticket.status as Status] ?? STATUS_BANNER.open) : null;
  const attachments = (ticket as (typeof ticket & { attachments?: { id: string; fileName: string; mimeType: string; fileSize: number; url: string; createdAt: string }[] }) | undefined)?.attachments ?? [];

  return (
    <KeyboardAvoidingView style={[s.container, { paddingTop: topPad }]} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <View style={[s.header, BLUR]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={17} color={colors.mutedForeground} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>
            {isLoading ? "Loading…" : (ticket?.productName ?? "Ticket")}
          </Text>
          {ticket && <Text style={s.headerSub}>#{id?.slice(-8)} · Updates every 20 sec</Text>}
        </View>
        <TouchableOpacity
          style={s.refreshBtn}
          onPress={() => { setNewAdminReplies(0); void refetch(); }}
          disabled={isRefetching}
          accessibilityLabel="Refresh ticket conversation"
        >
          <Feather name="refresh-cw" size={14} color={isRefetching ? colors.primary : colors.mutedForeground} />
        </TouchableOpacity>
        {ticket && <StatusBadge status={ticket.status as Status} />}
      </View>

      {isLoading && (
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.stateText}>Loading ticket…</Text>
        </View>
      )}
      {isError && !isLoading && (
        <View style={s.centeredState}>
          <Feather name="alert-circle" size={40} color={colors.destructive} style={{ opacity: 0.5 }} />
          <Text style={s.stateText}>Failed to load ticket</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {ticket && (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
          {statusBanner && (
            <View style={[s.statusBanner, { backgroundColor: statusBanner.bg, borderColor: statusBanner.border }]}>
              <View style={[s.statusDot, { backgroundColor: statusBanner.color }]} />
              <Text style={[s.statusBannerText, { color: statusBanner.color }]}>{statusBanner.label}</Text>
            </View>
          )}

          <View style={s.section}>
            <Text style={s.sectionLabel}>Ticket Details</Text>
            <View style={s.card}>
              <Text style={s.productName}>{ticket.productName}</Text>
              <Text style={s.description}>{ticket.description}</Text>
              <View style={[s.metaRow, { borderTopColor: colors.border }]}>
                <Feather name="clock" size={11} color={colors.mutedForeground} />
                <Text style={s.metaText}>{formatDate(ticket.createdAt)}</Text>
              </View>
            </View>
          </View>

          {ticket.status === "resolved" && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Resolution Feedback</Text>
              {ticket.rating ? (
                <View style={s.ratingCard}>
                  <View style={s.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => <Feather key={star} name="star" size={17} color={star <= ticket.rating! ? "#F59E0B" : colors.border} />)}
                  </View>
                  <Text style={s.ratingSavedText}>Thank you for rating this resolution.</Text>
                  {ticket.feedbackText ? <Text style={s.feedbackSavedText}>{ticket.feedbackText}</Text> : null}
                </View>
              ) : (
                <View style={s.ratingCard}>
                  <Text style={s.ratingTitle}>How was your support experience?</Text>
                  <View style={s.ratingRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity key={star} onPress={() => setRating(star)} accessibilityLabel={`Rate ${star} stars`}>
                        <Feather name="star" size={28} color={star <= rating ? "#F59E0B" : colors.border} />
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput
                    value={feedback}
                    onChangeText={setFeedback}
                    placeholder="Optional feedback"
                    placeholderTextColor={colors.mutedForeground}
                    style={s.feedbackInput}
                    multiline
                    maxLength={500}
                  />
                  <TouchableOpacity style={[s.rateButton, rating < 1 && { opacity: 0.5 }]} onPress={submitRating} disabled={rating < 1 || rateMutation.isPending}>
                    {rateMutation.isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.rateButtonText}>Send feedback</Text>}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Attachments */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Attachments</Text>
              <TouchableOpacity style={s.attachBtn} onPress={handlePickImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <>
                    <Feather name="paperclip" size={12} color={colors.primary} />
                    <Text style={s.attachBtnText}>Add File</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            {attachments.length === 0 ? (
              <TouchableOpacity style={s.emptyAttach} onPress={handlePickImage} disabled={uploading} activeOpacity={0.7}>
                <Feather name="image" size={22} color={colors.border} />
                <Text style={s.emptyAttachText}>No attachments yet</Text>
                <Text style={s.emptyAttachSub}>Tap to attach a screenshot or image</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.attachList}>
                {attachments.map((att) => {
                  const isImage = att.mimeType.startsWith("image/");
                  return (
                    <View key={att.id} style={s.attachItem}>
                      {isImage ? (
                        <Image source={{ uri: att.url }} style={s.attachThumb} resizeMode="cover" />
                      ) : (
                        <View style={[s.attachThumb, s.attachFileIcon]}>
                          <Feather name="file" size={20} color={colors.primary} />
                        </View>
                      )}
                      <View style={s.attachMeta}>
                        <Text style={s.attachName} numberOfLines={1}>{att.fileName}</Text>
                        <Text style={s.attachSize}>{formatBytes(att.fileSize)} · {formatTime(att.createdAt)}</Text>
                      </View>
                    </View>
                  );
                })}
                <TouchableOpacity style={s.addMoreBtn} onPress={handlePickImage} disabled={uploading} activeOpacity={0.7}>
                  <Feather name="plus" size={13} color={colors.primary} />
                  <Text style={s.addMoreText}>Add another</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Conversation */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <View style={s.conversationHeading}>
                <Text style={s.sectionLabel}>Conversation</Text>
                {newAdminReplies > 0 && (
                  <View style={s.unreadPill}>
                    <Text style={s.unreadPillText}>{newAdminReplies} new reply{newAdminReplies === 1 ? "" : "ies"}</Text>
                  </View>
                )}
              </View>
              <Text style={s.replyCount}>{ticket.replies.length} {ticket.replies.length === 1 ? "message" : "messages"}</Text>
            </View>
            {ticket.replies.length === 0 ? (
              <View style={s.emptyReplies}>
                <Feather name="message-circle" size={26} color={colors.border} />
                <Text style={s.emptyText}>No messages yet</Text>
                <Text style={s.emptySub}>Send a message and our team will respond shortly.</Text>
              </View>
            ) : (
              <View style={s.repliesList}>
                {ticket.replies.map((reply) => {
                  const isAdmin = reply.authorRole === "admin";
                  return (
                    <View key={reply.id} style={[s.bubble, isAdmin ? s.bubbleAdmin : s.bubbleUser]}>
                      <View style={s.bubbleMeta}>
                        <View style={[s.bubbleAvatar, { backgroundColor: isAdmin ? "rgba(99,102,241,0.2)" : colors.secondary }]}>
                          <Text style={[s.bubbleAvatarText, { color: isAdmin ? "#A5B4FC" : colors.mutedForeground }]}>
                            {reply.authorName[0]?.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={s.bubbleAuthor}>{isAdmin ? "Support Team" : "You"}</Text>
                        {isAdmin && (
                          <View style={s.adminBadge}>
                            <Text style={s.adminBadgeText}>ADMIN</Text>
                          </View>
                        )}
                        <Text style={s.bubbleTime}>{formatTime(reply.createdAt)}</Text>
                      </View>
                      <Text style={s.bubbleMessage}>{reply.message}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Send Message */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Send a Message</Text>
            <View style={s.replyBox}>
              <TextInput
                style={[
                  s.replyInput,
                  replyFocused && s.replyInputFocused,
                  Platform.OS === "web" && replyFocused
                    ? ({ boxShadow: "0 0 0 3px rgba(99,102,241,0.2)" } as object) : {},
                ]}
                placeholder="Describe your issue or reply to the team…"
                placeholderTextColor={colors.mutedForeground}
                value={replyText}
                onChangeText={setReplyText}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                onFocus={() => setReplyFocused(true)}
                onBlur={() => setReplyFocused(false)}
              />
              <TouchableOpacity
                style={[s.sendBtn, { backgroundColor: replyText.trim() ? colors.primary : colors.secondary }]}
                onPress={handleSendReply}
                disabled={!replyText.trim() || replyMutation.isPending}
                activeOpacity={0.85}
              >
                {replyMutation.isPending ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Feather name="send" size={14} color={replyText.trim() ? "#fff" : colors.mutedForeground} />
                    <Text style={[s.sendBtnText, { color: replyText.trim() ? "#fff" : colors.mutedForeground }]}>Send Message</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {sentVisible && (
        <Animated.View style={[s.toast, { opacity: sentOpacity, bottom: insets.bottom + 24, borderColor: toastSuccess ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)", backgroundColor: toastSuccess ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)" }]}>
          <Feather name={toastSuccess ? "check-circle" : "alert-circle"} size={14} color={toastSuccess ? "#4ADE80" : "#F87171"} />
          <Text style={[s.toastText, { color: toastSuccess ? "#4ADE80" : "#F87171" }]}>{toastMsg}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>, isDark: boolean) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 16, paddingVertical: 14,
      backgroundColor: isDark ? "rgba(15,23,42,0.95)" : "rgba(248,250,252,0.95)",
      borderBottomWidth: 1, borderBottomColor: colors.border,
    },
    backBtn: {
      width: 34, height: 34, borderRadius: 8,
      backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border,
      alignItems: "center", justifyContent: "center",
    },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    refreshBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border },
    centeredState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    stateText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4, backgroundColor: colors.primary },
    retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    statusBanner: {
      flexDirection: "row", alignItems: "center", gap: 8,
      marginHorizontal: 16, marginTop: 16, paddingHorizontal: 13, paddingVertical: 10,
      borderRadius: 8, borderWidth: 1,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusBannerText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
    scroll: { flex: 1 },
    section: { paddingHorizontal: 16, paddingTop: 18 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    conversationHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
    unreadPill: { backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
    unreadPillText: { color: "#FFFFFF", fontSize: 10, fontFamily: "Inter_600SemiBold" },
    replyCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
    ratingCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 12 },
    ratingTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    ratingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    ratingSavedText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.foreground },
    feedbackSavedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 20 },
    feedbackInput: { minHeight: 76, padding: 11, color: colors.foreground, backgroundColor: colors.input, borderColor: colors.border, borderWidth: 1, borderRadius: 8, fontFamily: "Inter_400Regular", textAlignVertical: "top" },
    rateButton: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingVertical: 11, borderRadius: 8 },
    rateButtonText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    productName: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 6 },
    description: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 22, marginBottom: 14 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12, borderTopWidth: 1 },
    metaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    attachBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.08)", borderWidth: 1, borderColor: "rgba(99,102,241,0.25)" },
    attachBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: colors.primary },
    emptyAttach: { alignItems: "center", paddingVertical: 28, gap: 6, borderWidth: 1, borderRadius: 12, borderStyle: "dashed", borderColor: colors.border },
    emptyAttachText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    emptyAttachSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.muted },
    attachList: { gap: 8 },
    attachItem: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
    attachThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: colors.secondary },
    attachFileIcon: { alignItems: "center", justifyContent: "center" },
    attachMeta: { flex: 1 },
    attachName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    attachSize: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    addMoreBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(99,102,241,0.3)" },
    addMoreText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.primary },
    emptyReplies: { alignItems: "center", paddingVertical: 32, gap: 7, borderWidth: 1, borderRadius: 12, borderStyle: "dashed", borderColor: colors.border },
    emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", color: colors.mutedForeground },
    emptySub: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.muted, textAlign: "center", paddingHorizontal: 24 },
    repliesList: { gap: 10 },
    bubble: { borderRadius: 12, padding: 14, borderWidth: 1 },
    bubbleAdmin: { backgroundColor: isDark ? "#1A2744" : "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.2)" },
    bubbleUser: { backgroundColor: colors.card, borderColor: colors.border },
    bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    bubbleAvatar: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    bubbleAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
    bubbleAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    adminBadge: { backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
    adminBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#A5B4FC", letterSpacing: 0.6 },
    bubbleTime: { marginLeft: "auto", fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    bubbleMessage: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 21 },
    replyBox: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    replyInput: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, padding: 12,
      fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
      minHeight: 96, marginBottom: 12,
    },
    replyInputFocused: { borderColor: colors.primary, borderWidth: 2, backgroundColor: `rgba(99,102,241,${isDark ? "0.08" : "0.04"})` },
    sendBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingVertical: 12, borderRadius: 8 },
    sendBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    toast: {
      position: "absolute", left: 16, right: 16,
      flexDirection: "row", alignItems: "center", gap: 10,
      borderWidth: 1, borderRadius: 12, padding: 14,
      shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    toastText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  });
}
