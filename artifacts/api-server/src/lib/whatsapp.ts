import { logger } from "./logger";

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;

const configured = Boolean(
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_WHATSAPP_FROM,
);

if (!configured) {
  logger.warn(
    "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_WHATSAPP_FROM not set — " +
      "WhatsApp notifications will fall back to dev logging.",
  );
}

export function isWhatsappConfigured(): boolean {
  return configured;
}

function normalizePhone(phone: string): string | null {
  const trimmed = phone.trim().replace(/[\s()-]/g, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("whatsapp:")) return trimmed;
  if (trimmed.startsWith("+")) return `whatsapp:${trimmed}`;
  if (/^\d{7,15}$/.test(trimmed)) return `whatsapp:+${trimmed}`;
  return null;
}

function formatFrom(from: string): string {
  return from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
}

/**
 * Send a WhatsApp message via Twilio.
 *
 * Returns:
 *   { sent: true }                 — delivered to Twilio
 *   { sent: false, devBody: string } — provider not configured; logged to console
 */
export async function sendWhatsappMessage(
  toPhone: string,
  body: string,
): Promise<{ sent: boolean; devBody?: string }> {
  const to = normalizePhone(toPhone);
  if (!to) {
    logger.warn({ toPhone }, "WhatsApp send skipped — invalid phone number");
    return { sent: false };
  }

  if (!configured) {
    logger.warn({ toPhone }, "WhatsApp send skipped — Twilio not configured");
    console.log("\n========================================");
    console.log(`DEV: WhatsApp to ${toPhone}`);
    console.log(body);
    console.log("========================================\n");
    return { sent: false, devBody: body };
  }

  try {
    const params = new URLSearchParams({
      From: formatFrom(TWILIO_WHATSAPP_FROM!),
      To: to,
      Body: body,
    });
    const auth = Buffer.from(
      `${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`,
    ).toString("base64");
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    );
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      logger.error(
        { status: resp.status, text, toPhone },
        "Twilio WhatsApp send failed",
      );
      return { sent: false };
    }
    logger.info({ toPhone }, "WhatsApp message sent via Twilio");
    return { sent: true };
  } catch (err) {
    logger.error({ err, toPhone }, "Twilio WhatsApp send exception");
    return { sent: false };
  }
}
