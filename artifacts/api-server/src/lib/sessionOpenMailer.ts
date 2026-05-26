/**
 * Task D — session-open email dispatch with per-user 12h cooldown.
 *
 * Reuses the same cooldown pattern as the setup reminder job. When a group
 * training transitions from 'scheduled' → 'open' we notify all level-eligible
 * players via the in-app notification table (already done by the existing
 * dispatchNotifications training_open flow) AND send an email — but skip the
 * email if we've already sent this user any session-open email in the last
 * 12 hours, to avoid spamming when several trainings open at once.
 */
import { db, usersTable, notificationsTable } from "@workspace/db";
import { and, eq, gte, inArray } from "drizzle-orm";
import { sendNotificationEmail } from "./mail";
import { fireAndForget } from "./fireAndForget";
import { logger } from "./logger";

const PLAYER_LEVELS = [
  "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A",
] as const;
const PLAYER_LEVEL_INDEX: Record<string, number> = Object.fromEntries(
  PLAYER_LEVELS.map((l, i) => [l, i]),
);
const CATEGORY_INDEX: Record<string, number> = {
  "D-": 0, "D": 1, "D+": 2, "C-": 3, "C": 4, "C+": 5, "B-": 6,
};

export const SESSION_OPEN_EMAIL_COOLDOWN_HOURS = 12;

function appUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const first = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  return first ? `https://${first}` : "http://localhost:80";
}

function buildEmailHtml(args: {
  name: string;
  category: string;
  courtName: string;
  whenLocal: string;
  link: string;
}): string {
  const { name, category, courtName, whenLocal, link } = args;
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#080c14;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#0f1520;border-radius:16px;border:1px solid #1e2a40;max-width:520px;width:100%;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a40;">
<span style="font-family:Georgia,serif;font-size:22px;color:#D4AF37;">🎾 Padel Concierge</span>
</td></tr>
<tr><td style="padding:28px 40px 0;">
<h2 style="margin:0 0 8px;font-size:20px;color:#e8eaf0;">Registration is open — ${category}</h2>
<p style="margin:0 0 4px;font-size:15px;color:#8a9ab8;line-height:1.6;">Hi ${name},</p>
<p style="margin:0 0 16px;font-size:15px;color:#8a9ab8;line-height:1.6;">
A group training matching your level just opened for booking:<br/>
<strong style="color:#e8eaf0;">${category} · ${courtName}</strong><br/>
${whenLocal}
</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:10px;background:#D4AF37;">
<a href="${link}" style="display:inline-block;padding:12px 26px;color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Reserve my spot →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #1e2a40;"></div></td></tr>
<tr><td style="padding:28px 40px 0;">
<h2 style="margin:0 0 8px;font-size:20px;color:#e8eaf0;">Запись открыта — ${category}</h2>
<p style="margin:0 0 4px;font-size:15px;color:#8a9ab8;line-height:1.6;">${name}, привет!</p>
<p style="margin:0 0 16px;font-size:15px;color:#8a9ab8;line-height:1.6;">
Открылась запись на групповую тренировку под ваш уровень:<br/>
<strong style="color:#e8eaf0;">${category} · ${courtName}</strong><br/>
${whenLocal}
</p>
<table cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:10px;background:#1a2d52;border:1px solid #D4AF37;">
<a href="${link}" style="display:inline-block;padding:12px 26px;color:#D4AF37;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Забронировать место →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 32px;"><div style="border-top:1px solid #1e2a40;padding-top:20px;">
<p style="margin:0;font-size:12px;color:#3a4a63;">Padel Concierge · Dubai. To stop these alerts, reply STOP.</p>
</div></td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Send session-open email to every level-eligible active player, respecting a
 * 12h per-user cooldown enforced via the notifications table.
 */
export async function dispatchSessionOpenEmails(training: {
  id: string;
  category: string;
  dateTime: Date;
  courtName: string;
}): Promise<void> {
  const tIdx = CATEGORY_INDEX[training.category] ?? 99;
  const eligible = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, level: usersTable.level })
    .from(usersTable)
    .where(eq(usersTable.role, "player"));

  const targets = eligible.filter((u) => {
    const lvl = u.level ? PLAYER_LEVEL_INDEX[u.level] ?? -1 : -1;
    return lvl >= 0 && tIdx <= lvl && !!u.email;
  });
  if (targets.length === 0) return;

  // Cooldown check: did we send a session_open_email to this user in last 12h?
  const cutoff = new Date(Date.now() - SESSION_OPEN_EMAIL_COOLDOWN_HOURS * 60 * 60 * 1000);
  const recent = await db
    .select({ userId: notificationsTable.userId })
    .from(notificationsTable)
    .where(
      and(
        eq(notificationsTable.kind, "session_open_email"),
        gte(notificationsTable.createdAt, cutoff),
        inArray(notificationsTable.userId, targets.map((t) => t.id)),
      ),
    );
  const onCooldown = new Set(recent.map((r) => r.userId));

  const finalTargets = targets.filter((t) => !onCooldown.has(t.id));
  if (finalTargets.length === 0) {
    logger.info({ trainingId: training.id, skipped: targets.length }, "sessionOpenMailer: all on cooldown");
    return;
  }

  const link = `${appUrl()}/group-trainings/${training.id}`;
  const whenLocal = training.dateTime.toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }) + " (Dubai)";

  const subject = `Group training opened — ${training.category} / Запись открыта`;

  // Send emails (fire-and-forget) + log cooldown markers
  for (const u of finalTargets) {
    const html = buildEmailHtml({
      name: u.name,
      category: training.category,
      courtName: training.courtName,
      whenLocal,
      link,
    });
    fireAndForget(
      sendNotificationEmail(u.email, subject, html),
      { trainingId: training.id, userId: u.id, kind: "session_open_email" },
    );
  }

  // Mark cooldown by inserting one notification row per user (kind: session_open_email).
  // This row is purely a delivery ledger — the user-facing "training_open" notification
  // is created separately in dispatchNotifications().
  try {
    await db
      .insert(notificationsTable)
      .values(
        finalTargets.map((u) => ({
          userId: u.id,
          kind: "session_open_email",
          trainingId: training.id,
          titleEn: "Session open (email)",
          titleRu: "Запись открыта (email)",
          bodyEn: `${training.category} · ${training.courtName}`,
          bodyRu: `${training.category} · ${training.courtName}`,
          link,
        })),
      )
      .onConflictDoNothing({
        target: [notificationsTable.userId, notificationsTable.kind, notificationsTable.trainingId],
      });
  } catch (err) {
    logger.error({ err, trainingId: training.id }, "sessionOpenMailer: cooldown ledger insert failed");
  }

  logger.info(
    { trainingId: training.id, sent: finalTargets.length, skipped: onCooldown.size },
    "sessionOpenMailer: dispatched",
  );
}
