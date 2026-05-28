import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:hello@padelconcierge.com";

let configured = false;
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    configured = true;
  } catch (err) {
    logger.warn({ err }, "Failed to configure web-push VAPID details");
  }
} else {
  logger.warn(
    "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY not set — push notifications disabled. " +
      "Run `npx web-push generate-vapid-keys` and set them as secrets.",
  );
}

export function isPushConfigured(): boolean {
  return configured;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<void> {
  if (!configured) return;
  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  if (subs.length === 0) return;

  const json = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          json,
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          // Subscription is gone; clean up.
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.id, s.id))
            .catch(() => {});
        } else {
          logger.warn({ err, userId, endpoint: s.endpoint }, "Push send failed");
        }
      }
    }),
  );
}
