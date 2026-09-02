import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTheme } from "@/contexts/ThemeContext";
import ThemeToggle from "@/components/ThemeToggle";

const BLUR = Platform.OS === "web" ? ({ backdropFilter: "blur(12px)" } as object) : {};

const POLICY_SECTIONS = [
  {
    number: "01",
    title: "Information we collect",
    icon: "user",
    body: "When you use SupportDesk, we collect the information needed to provide support services: your name, email address, account credentials, support ticket details, replies, ratings, and any attachments you choose to submit. We may also store an optional device push-notification token when you enable notifications.",
  },
  {
    number: "02",
    title: "How we use your information",
    icon: "target",
    body: "We use your information to authenticate your account, receive and resolve support requests, show your ticket history, send ticket updates, improve the support experience, and protect the service from misuse. We do not use ticket content for unrelated advertising.",
  },
  {
    number: "03",
    title: "Tickets and attachments",
    icon: "paperclip",
    body: "Ticket content is visible to authorized SupportDesk administrators and agents who need it to provide support. Attachments are optional and should only contain information relevant to your request. Do not upload passwords, payment card details, or other sensitive information that support does not need.",
  },
  {
    number: "04",
    title: "Notifications and email",
    icon: "bell",
    body: "If configured for your workspace, SupportDesk may send email or push notifications about ticket creation, replies, status changes, and account recovery. You can disable device notifications in your phone settings. Account and security messages may still be sent when necessary.",
  },
  {
    number: "05",
    title: "When information is shared",
    icon: "users",
    body: "We share information only with authorized members of your support organization and service providers that help operate the application, such as hosting, email, notification, and database providers. We do not sell your personal information.",
  },
  {
    number: "06",
    title: "Security",
    icon: "shield",
    body: "SupportDesk uses access controls, password hashing, authenticated sessions, and encrypted network connections where supported to help protect your information. No online service can guarantee absolute security, so please keep your password private and report suspicious activity promptly.",
  },
  {
    number: "07",
    title: "Retention and deletion",
    icon: "archive",
    body: "We retain account, ticket, and audit information for as long as it is needed to provide support, maintain service records, meet security requirements, or comply with applicable obligations. To request account or data deletion, contact your workspace administrator or support team.",
  },
  {
    number: "08",
    title: "Your choices",
    icon: "sliders",
    body: "You can review and update your name and password from Profile settings, request a password reset, and choose whether to allow push notifications. Your email address is kept as the account identifier and cannot be edited from the app.",
  },
  {
    number: "09",
    title: "Children’s privacy",
    icon: "heart",
    body: "SupportDesk is intended for business and customer-support use, not for children under the age required by applicable law. If you believe a child has provided personal information, contact the workspace administrator so it can be reviewed.",
  },
];

function PolicySection({
  item,
  colors,
}: {
  item: (typeof POLICY_SECTIONS)[number];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.sectionTop}>
        <View style={[styles.sectionIcon, { backgroundColor: `${colors.primary}18` }]}>
          <Feather name={item.icon as keyof typeof Feather.glyphMap} size={17} color={colors.primary} />
        </View>
        <Text style={[styles.sectionNumber, { color: colors.primary }]}>{item.number}</Text>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{item.title}</Text>
      <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{item.body}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDark } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}>
      <View style={[styles.header, BLUR, { backgroundColor: isDark ? "rgba(15,23,42,0.96)" : "rgba(248,250,252,0.96)", borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace("/(auth)/login")}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>SUPPORTDESK</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Privacy Policy</Text>
        </View>
        <ThemeToggle size={36} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary }]}>
            <Feather name="lock" size={23} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Your privacy, clearly explained.</Text>
            <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>
              This policy explains what SupportDesk collects, why it is used, and the choices you have.
            </Text>
            <View style={[styles.updatedBadge, { backgroundColor: isDark ? "rgba(34,197,94,0.12)" : "rgba(34,197,94,0.08)" }]}>
              <View style={styles.updatedDot} />
              <Text style={[styles.updatedText, { color: colors.success }]}>Updated Aug 22, 2026</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.intro, { color: colors.mutedForeground }]}>
          This Privacy Policy applies to the SupportDesk application and describes how information is handled when you create an account or use the service.
        </Text>

        {POLICY_SECTIONS.map((item) => (
          <PolicySection key={item.number} item={item} colors={colors} />
        ))}

        <View style={[styles.contactCard, { backgroundColor: isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.07)", borderColor: isDark ? "rgba(99,102,241,0.28)" : "rgba(99,102,241,0.2)" }]}>
          <Feather name="message-circle" size={18} color={colors.primary} />
          <View style={styles.contactCopy}>
            <Text style={[styles.contactTitle, { color: colors.foreground }]}>Questions about your data?</Text>
            <Text style={[styles.contactBody, { color: colors.mutedForeground }]}>
              Contact your workspace administrator or support team for privacy requests and account questions.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 11,
    paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 11, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  headerCopy: { flex: 1, gap: 1 },
  eyebrow: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  headerTitle: { fontSize: 20, lineHeight: 25, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 14, maxWidth: 760, width: "100%", alignSelf: "center" },
  hero: {
    padding: 18, borderRadius: 17, borderWidth: 1,
    flexDirection: "row", alignItems: "flex-start", gap: 13,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1, gap: 5 },
  heroTitle: { fontSize: 18, lineHeight: 23, fontFamily: "Inter_700Bold" },
  heroBody: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
  updatedBadge: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, marginTop: 3,
  },
  updatedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  updatedText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  intro: { fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", paddingHorizontal: 2 },
  sectionCard: { padding: 16, borderRadius: 15, borderWidth: 1 },
  sectionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  sectionNumber: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.8 },
  sectionTitle: { fontSize: 15, lineHeight: 20, fontFamily: "Inter_700Bold", marginBottom: 7 },
  sectionBody: { fontSize: 13, lineHeight: 21, fontFamily: "Inter_400Regular" },
  contactCard: { flexDirection: "row", alignItems: "flex-start", gap: 11, padding: 16, borderRadius: 15, borderWidth: 1, marginTop: 2 },
  contactCopy: { flex: 1, gap: 4 },
  contactTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  contactBody: { fontSize: 12, lineHeight: 19, fontFamily: "Inter_400Regular" },
});