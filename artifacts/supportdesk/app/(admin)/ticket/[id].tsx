import React, { useState, useRef } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Animated,
  Modal, Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  useGetAdminTicketDetail, useUpdateTicketStatus, useCreateTicketReply,
  useAssignTicket, useGetAdminAgents,
  getGetAdminTicketDetailQueryKey, getGetAdminTicketsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import StatusBadge from "@/components/StatusBadge";

type Status = "open" | "in-progress" | "resolved";

const STATUS_OPTIONS: { value: Status; label: string; color: string; bg: string; border: string }[] = [
  { value: "open",        label: "Open",        color: "#A5B4FC", bg: "rgba(99,102,241,0.12)",  border: "rgba(99,102,241,0.3)" },
  { value: "in-progress", label: "In Progress", color: "#FCD34D", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  { value: "resolved",    label: "Resolved",    color: "#4ADE80", bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.3)" },
];

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

export default function TicketDetailScreen() {
  const colors = useColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [replyText, setReplyText] = useState("");
  const [replyFocused, setReplyFocused] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastSuccess, setToastSuccess] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const { data, isLoading, isError, refetch } = useGetAdminTicketDetail(id ?? "");
  const { data: agentsData } = useGetAdminAgents();
  const ticket = data?.data;
  const agents = agentsData?.data ?? [];

  const statusMutation = useUpdateTicketStatus();
  const replyMutation = useCreateTicketReply();
  const assignMutation = useAssignTicket();

  function showToast(msg: string, success = true) {
    setToastMsg(msg);
    setToastSuccess(success);
    setToastVisible(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => setToastVisible(false));
  }

  async function handleStatusChange(newStatus: Status) {
    if (!id || ticket?.status === newStatus) return;
    Haptics.selectionAsync();
    try {
      await statusMutation.mutateAsync({ ticketId: id, data: { status: newStatus } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: getGetAdminTicketsQueryKey() }),
      ]);
      showToast("Status updated", true);
    } catch { showToast("Failed to update status", false); }
  }

  async function handleAssign(agentId: string | null) {
    if (!id) return;
    setShowAssignPicker(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await assignMutation.mutateAsync({ ticketId: id, data: { agentId } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(id) }),
        queryClient.invalidateQueries({ queryKey: getGetAdminTicketsQueryKey() }),
      ]);
      showToast(agentId ? "Ticket assigned" : "Assignment cleared", true);
    } catch { showToast("Failed to assign ticket", false); }
  }

  async function handleSendReply() {
    if (!id || !replyText.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await replyMutation.mutateAsync({ ticketId: id, data: { message: replyText.trim() } });
      setReplyText("");
      await queryClient.invalidateQueries({ queryKey: getGetAdminTicketDetailQueryKey(id) });
      showToast("Reply sent", true);
    } catch { showToast("Failed to send reply", false); }
  }

  const s = makeStyles(colors, isDark);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  type TicketWithExtras = typeof ticket & {
    assignedTo?: string | null;
    assignedToName?: string | null;
    attachments?: { id: string; fileName: string; mimeType: string; fileSize: number; url: string; createdAt: string }[];
  };
  const ticketEx = ticket as TicketWithExtras;
  const attachments = ticketEx?.attachments ?? [];
  const assignedToName = ticketEx?.assignedToName ?? null;

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
          {ticket && <Text style={s.headerSub}>#{id?.slice(-8)}</Text>}
        </View>
        {ticket && <StatusBadge status={ticket.status as Status} />}
      </View>

      {isLoading && (
        <View style={s.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={s.stateText}>Fetching ticket…</Text>
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

          {/* Submitted By */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Submitted By</Text>
            <View style={s.metaCard}>
              <View style={s.avatarCircle}>
                <Text style={s.avatarText}>{ticket.userName[0]?.toUpperCase()}</Text>
              </View>
              <View style={s.metaInfo}>
                <Text style={s.metaName}>{ticket.userName}</Text>
                <Text style={s.metaEmail}>{ticket.userEmail}</Text>
              </View>
              <Text style={s.metaDate}>{formatDate(ticket.createdAt)}</Text>
            </View>
          </View>

          {/* Assignment */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Assigned Agent</Text>
              {assignedToName && (
                <TouchableOpacity onPress={() => handleAssign(null)} style={s.clearBtn}>
                  <Text style={s.clearBtnText}>Unassign</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={s.assignCard} onPress={() => setShowAssignPicker(true)} activeOpacity={0.75}>
              {assignMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : assignedToName ? (
                <>
                  <View style={s.assignAvatar}>
                    <Text style={s.assignAvatarText}>{assignedToName[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={s.assignedName}>{assignedToName}</Text>
                  <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                </>
              ) : (
                <>
                  <View style={s.assignAvatarEmpty}>
                    <Feather name="user-plus" size={14} color={colors.mutedForeground} />
                  </View>
                  <Text style={s.assignPlaceholder}>Tap to assign to an agent</Text>
                  <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Issue Details */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Issue Details</Text>
            <View style={s.detailCard}>
              <Text style={s.detailProduct}>{ticket.productName}</Text>
              <Text style={s.detailDescription}>{ticket.description}</Text>
            </View>
          </View>

          {/* Customer Feedback */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Customer Feedback</Text>
            {ticket.rating != null ? (
              <View style={s.feedbackCard}>
                <View style={s.feedbackRatingRow}>
                  <View style={s.feedbackStars}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Feather
                        key={star}
                        name="star"
                        size={18}
                        color={star <= ticket.rating! ? "#F59E0B" : colors.border}
                        fill={star <= ticket.rating! ? "#F59E0B" : "transparent"}
                      />
                    ))}
                  </View>
                  <Text style={s.feedbackScore}>{ticket.rating} / 5</Text>
                </View>
                <Text style={ticket.feedbackText?.trim() ? s.feedbackMessage : s.feedbackNoMessage}>
                  {ticket.feedbackText?.trim()
                    ? `“${ticket.feedbackText.trim()}”`
                    : "The customer left a rating without a written comment."}
                </Text>
              </View>
            ) : (
              <View style={s.feedbackEmpty}>
                <Feather name="star" size={20} color={colors.border} />
                <Text style={s.feedbackEmptyText}>The customer has not left a rating or feedback yet.</Text>
              </View>
            )}
          </View>

          {/* Attachments */}
          {attachments.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionLabel}>Attachments ({attachments.length})</Text>
              <View style={s.attachList}>
                {attachments.map((att) => {
                  const isImage = att.mimeType.startsWith("image/");
                  return (
                    <View key={att.id} style={s.attachItem}>
                      {isImage ? (
                        <Image source={{ uri: att.url }} style={s.attachThumb} resizeMode="cover" />
                      ) : (
                        <View style={[s.attachThumb, s.attachFileIcon]}>
                          <Feather name="file" size={18} color={colors.primary} />
                        </View>
                      )}
                      <View style={s.attachMeta}>
                        <Text style={s.attachName} numberOfLines={1}>{att.fileName}</Text>
                        <Text style={s.attachSize}>{formatBytes(att.fileSize)} · {formatTime(att.createdAt)}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Status */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Update Status</Text>
            <View style={s.statusCard}>
              <View style={s.statusBtns}>
                {STATUS_OPTIONS.map((opt) => {
                  const isActive = ticket.status === opt.value;
                  const isUpdating = statusMutation.isPending && statusMutation.variables?.data?.status === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.statusBtn, { borderColor: isActive ? opt.border : colors.border, backgroundColor: isActive ? opt.bg : colors.secondary }]}
                      onPress={() => handleStatusChange(opt.value)}
                      activeOpacity={0.75}
                      disabled={statusMutation.isPending}
                    >
                      {isUpdating ? <ActivityIndicator size="small" color={opt.color} /> : (
                        <>
                          {isActive && <Feather name="check" size={11} color={opt.color} />}
                          <Text style={[s.statusBtnText, { color: isActive ? opt.color : colors.mutedForeground, fontFamily: isActive ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
                            {opt.label}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Conversation */}
          <View style={s.section}>
            <View style={s.sectionRow}>
              <Text style={s.sectionLabel}>Conversation</Text>
              <Text style={s.replyCount}>{ticket.replies.length} {ticket.replies.length === 1 ? "reply" : "replies"}</Text>
            </View>
            {ticket.replies.length === 0 ? (
              <View style={s.emptyReplies}>
                <Feather name="message-circle" size={26} color={colors.border} />
                <Text style={s.emptyRepliesText}>No replies yet</Text>
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
                        <Text style={s.bubbleAuthor}>{reply.authorName}</Text>
                        {isAdmin && (
                          <View style={s.adminTag}>
                            <Text style={s.adminTagText}>ADMIN</Text>
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

          {/* Reply */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>Post a Reply</Text>
            <View style={s.replyInputCard}>
              <TextInput
                style={[
                  s.replyInput,
                  replyFocused && s.replyInputFocused,
                  Platform.OS === "web" && replyFocused
                    ? ({ boxShadow: "0 0 0 3px rgba(99,102,241,0.2)" } as object) : {},
                ]}
                placeholder="Write your reply to the user…"
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
                    <Text style={[s.sendBtnText, { color: replyText.trim() ? "#fff" : colors.mutedForeground }]}>Send Reply</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      )}

      {/* Toast */}
      {toastVisible && (
        <Animated.View style={[s.toast, {
          opacity: toastOpacity, bottom: insets.bottom + 24,
          borderColor: toastSuccess ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)",
          backgroundColor: toastSuccess ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        }]}>
          <Feather name={toastSuccess ? "check-circle" : "alert-circle"} size={14} color={toastSuccess ? "#4ADE80" : "#F87171"} />
          <Text style={[s.toastText, { color: toastSuccess ? "#4ADE80" : "#F87171" }]}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* Agent Picker Modal */}
      <Modal visible={showAssignPicker} transparent animationType="slide" onRequestClose={() => setShowAssignPicker(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowAssignPicker(false)}>
          <View style={[s.modalSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 8 }]}>
            <View style={s.modalHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Assign to Agent</Text>
            <ScrollView style={s.agentList}>
              <TouchableOpacity style={[s.agentRow, { borderColor: colors.border }]} onPress={() => handleAssign(null)} activeOpacity={0.7}>
                <View style={[s.agentAvatar, { backgroundColor: colors.secondary }]}>
                  <Feather name="x" size={14} color={colors.mutedForeground} />
                </View>
                <Text style={[s.agentName, { color: colors.mutedForeground }]}>Unassigned</Text>
              </TouchableOpacity>
              {agents.map((agent) => {
                const isSelected = ticketEx?.assignedTo === agent.id;
                return (
                  <TouchableOpacity key={agent.id} style={[s.agentRow, { borderColor: colors.border, backgroundColor: isSelected ? "rgba(99,102,241,0.08)" : "transparent" }]} onPress={() => handleAssign(agent.id)} activeOpacity={0.7}>
                    <View style={[s.agentAvatar, { backgroundColor: isSelected ? "rgba(99,102,241,0.2)" : colors.secondary }]}>
                      <Text style={[s.agentAvatarText, { color: isSelected ? "#A5B4FC" : colors.mutedForeground }]}>{agent.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.agentName, { color: colors.foreground }]}>{agent.name}</Text>
                      <Text style={[s.agentEmail, { color: colors.mutedForeground }]}>{agent.email}</Text>
                    </View>
                    {isSelected && <Feather name="check" size={14} color="#A5B4FC" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
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
    backBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
    headerCenter: { flex: 1 },
    headerTitle: { fontSize: 16, fontWeight: "700" as const, fontFamily: "Inter_700Bold", color: colors.foreground },
    headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 1 },
    centeredState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    stateText: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4, backgroundColor: colors.primary },
    retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
    scroll: { flex: 1 },
    section: { paddingHorizontal: 16, paddingTop: 18 },
    sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
    sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    replyCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    clearBtn: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.2)" },
    clearBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#F87171" },
    metaCard: { flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 12 },
    avatarCircle: { width: 38, height: 38, borderRadius: 10, backgroundColor: "rgba(99,102,241,0.15)", alignItems: "center", justifyContent: "center" },
    avatarText: { color: "#A5B4FC", fontSize: 15, fontFamily: "Inter_700Bold" },
    metaInfo: { flex: 1 },
    metaName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    metaEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    metaDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "right", maxWidth: 90 },
    assignCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    assignAvatar: { width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(99,102,241,0.2)", alignItems: "center", justifyContent: "center" },
    assignAvatarText: { color: "#A5B4FC", fontSize: 13, fontFamily: "Inter_700Bold" },
    assignAvatarEmpty: { width: 32, height: 32, borderRadius: 8, backgroundColor: colors.secondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border, borderStyle: "dashed" },
    assignedName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    assignPlaceholder: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    detailCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16 },
    detailProduct: { fontSize: 15, fontFamily: "Inter_700Bold", color: colors.foreground, marginBottom: 8 },
    detailDescription: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 22 },
    feedbackCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 15 },
    feedbackRatingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    feedbackStars: { flexDirection: "row", gap: 4 },
    feedbackScore: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#F59E0B" },
    feedbackMessage: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 21 },
    feedbackNoMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 20 },
    feedbackEmpty: { alignItems: "center", paddingVertical: 22, paddingHorizontal: 20, gap: 8, borderWidth: 1, borderRadius: 12, borderStyle: "dashed", borderColor: colors.border },
    feedbackEmptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center" },
    attachList: { gap: 8 },
    attachItem: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10 },
    attachThumb: { width: 44, height: 44, borderRadius: 7, backgroundColor: colors.secondary },
    attachFileIcon: { alignItems: "center", justifyContent: "center" },
    attachMeta: { flex: 1 },
    attachName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    attachSize: { fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 },
    statusCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    statusBtns: { flexDirection: "row", gap: 8 },
    statusBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
    statusBtnText: { fontSize: 12 },
    emptyReplies: { alignItems: "center", paddingVertical: 28, gap: 8, borderWidth: 1, borderRadius: 12, borderStyle: "dashed", borderColor: colors.border },
    emptyRepliesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    repliesList: { gap: 10 },
    bubble: { borderRadius: 12, padding: 14, borderWidth: 1 },
    bubbleAdmin: { backgroundColor: isDark ? "#1A2744" : "rgba(99,102,241,0.07)", borderColor: "rgba(99,102,241,0.2)" },
    bubbleUser: { backgroundColor: colors.card, borderColor: colors.border },
    bubbleMeta: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 8 },
    bubbleAvatar: { width: 26, height: 26, borderRadius: 7, alignItems: "center", justifyContent: "center" },
    bubbleAvatarText: { fontSize: 12, fontFamily: "Inter_700Bold" },
    bubbleAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground },
    adminTag: { backgroundColor: "rgba(99,102,241,0.15)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: "rgba(99,102,241,0.3)" },
    adminTagText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#A5B4FC", letterSpacing: 0.6 },
    bubbleTime: { marginLeft: "auto", fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground },
    bubbleMessage: { fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 21 },
    replyInputCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    replyInput: {
      backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border,
      borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: colors.foreground,
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
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
    modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 16, maxHeight: "60%" },
    modalHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#334155", alignSelf: "center", marginBottom: 16 },
    modalTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 14 },
    agentList: { maxHeight: 320 },
    agentRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderRadius: 8, paddingHorizontal: 4 },
    agentAvatar: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    agentAvatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
    agentName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
    agentEmail: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  });
}
