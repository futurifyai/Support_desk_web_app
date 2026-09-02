import { useEffect } from "react";
import { Platform } from "react-native";
import { useRouter } from "expo-router";

export default function NotificationSetup() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;
    let subscription: { remove: () => void } | null = null;

    void (async () => {
      try {
        // expo-notifications is not included in Expo Go SDK 53+.
        // Load it lazily so Expo Go can still run the rest of the app.
        const Notifications = await import("expo-notifications");
        if (cancelled) return;

        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
          }),
        });

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const ticketId = response.notification.request.content.data?.ticketId;
          if (typeof ticketId === "string") router.push(`/user-ticket/${ticketId}` as never);
        });
      } catch {
        // Expo Go does not provide the native notifications module.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [router]);

  return null;
}