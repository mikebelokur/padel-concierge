import webpush from "web-push";
import { db, pushSubscriptionsTable, usersTable } from "@workspace/db";
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

export type Lang = "en" | "ru" | "ar";

export interface LocalizedText {
  en: string;
  ru: string;
  ar: string;
}

export interface PushPayload {
  title: string | LocalizedText;
  body: string | LocalizedText;
  url?: string;
  tag?: string;
}

function pickLang(value: string | LocalizedText, lang: Lang): string {
  if (typeof value === "string") return value;
  return value[lang] ?? value.en;
}

function normalizeLang(raw: string | null | undefined): Lang {
  const v = (raw ?? "en").toLowerCase();
  if (v === "ru" || v.startsWith("ru")) return "ru";
  if (v === "ar" || v.startsWith("ar")) return "ar";
  return "en";
}

export async function sendPushToUser(
  userId: number,
  payload: PushPayload,
): Promise<void> {
  if (!configured) return;

  const [user] = await db
    .select({ language: usersTable.language })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const lang = normalizeLang(user?.language);

  const subs = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userId));
  if (subs.length === 0) return;

  const resolved = {
    title: pickLang(payload.title, lang),
    body: pickLang(payload.body, lang),
    url: payload.url,
    tag: payload.tag,
    lang,
  };
  const json = JSON.stringify(resolved);
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
