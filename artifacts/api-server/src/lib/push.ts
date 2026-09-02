import { logger } from "./logger";

type TicketNotification = {
  pushToken: string | null;
  title: string;
  body: string;
  ticketId: string;
};

export async function sendTicketPush(notification: TicketNotification): Promise<void> {
  if (!notification.pushToken?.startsWith("ExponentPushToken[")) return;

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        to: notification.pushToken,
        sound: "default",
        title: notification.title,
        body: notification.body,
        data: { ticketId: notification.ticketId, url: `/user-ticket/${notification.ticketId}` },
      }),
    });

    if (!response.ok) logger.warn({ status: response.status }, "Expo push notification failed");
  } catch (err) {
    logger.warn({ err }, "Expo push notification request failed");
  }
}