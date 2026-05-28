import { logger } from "./logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_ADDRESS = process.env.EMAIL_FROM ?? "Padel Concierge <onboarding@resend.dev>";

/**
 * Resolve the public app URL.
 *
 * Resolution order:
 *   1. APP_URL env var (explicit override — set this in production secrets)
 *   2. REPLIT_DOMAINS — first entry is the canonical production domain when
 *      deployed on Replit (automatically injected by the platform at runtime)
 *   3. Hard-coded fallback for local dev without either variable set
 */
function resolveAppUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL;
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) {
    const first = replitDomains.split(",")[0]?.trim();
    if (first) return `https://${first}`;
  }
  return "https://padelconcierge.com";
}

const APP_URL = resolveAppUrl();

function buildEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080c14;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0f1520;border-radius:16px;border:1px solid #1e2a40;overflow:hidden;max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a40;">
          <span style="font-family:Georgia,serif;font-size:22px;color:#2d7dff;letter-spacing:0.02em;">🎾 Padel Concierge</span>
        </td></tr>

        <!-- English -->
        <tr><td style="padding:32px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Reset your password</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">
            We received a request to reset the password for your account.
            Click the button below to set a new password.
            This link expires in <strong style="color:#e8eaf0;">1&nbsp;hour</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:10px;background:#2d7dff;">
              <a href="${resetUrl}"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Reset Password →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;font-size:13px;color:#4d5f7c;line-height:1.5;">
            If you didn't request this, you can safely ignore this email.
            Your password will not change.
          </p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #1e2a40;"></div></td></tr>

        <!-- Russian -->
        <tr><td style="padding:32px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Восстановление пароля</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">
            Мы получили запрос на сброс пароля для вашего аккаунта.
            Нажмите кнопку ниже, чтобы задать новый пароль.
            Ссылка действительна <strong style="color:#e8eaf0;">1&nbsp;час</strong>.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:10px;background:#1a2d52;border:1px solid #2d7dff;">
              <a href="${resetUrl}"
                 style="display:inline-block;padding:14px 32px;color:#7ab3ff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Сбросить пароль →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;font-size:13px;color:#4d5f7c;line-height:1.5;">
            Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.
            Ваш пароль останется прежним.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 40px 32px;">
          <div style="border-top:1px solid #1e2a40;padding-top:24px;">
            <p style="margin:0;font-size:12px;color:#3a4a63;line-height:1.6;">
              Padel Concierge · Dubai Private Members Club<br/>
              <span style="word-break:break-all;color:#2a3a52;">${resetUrl}</span>
            </p>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send a password reset email.
 *
 * Returns:
 *   { sent: true }                  — email dispatched via Resend
 *   { sent: false, devUrl: string } — no provider configured; URL logged to console
 */
export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<{ sent: boolean; devUrl?: string }> {
  const subject = "Reset your Padel Concierge password / Восстановление пароля";
  const html = buildEmailHtml(resetUrl);

  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) {
        logger.error({ err: error }, "Resend error — falling back to dev mode");
        return devFallback(to, resetUrl);
      }
      logger.info({ to }, "Password reset email sent via Resend");
      return { sent: true };
    } catch (err) {
      logger.error({ err }, "Resend exception — falling back to dev mode");
      return devFallback(to, resetUrl);
    }
  }

  return devFallback(to, resetUrl);
}

/**
 * Send a generic transactional notification email (subject + plain HTML body).
 * Falls back to a logger warning when Resend is not configured.
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean }> {
  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) {
        logger.error({ err: error, to, subject }, "Resend error sending notification");
        return { sent: false };
      }
      logger.info({ to, subject }, "Notification email sent");
      return { sent: true };
    } catch (err) {
      logger.error({ err, to, subject }, "Resend exception sending notification");
      return { sent: false };
    }
  }
  logger.warn({ to, subject }, "Email sending skipped — RESEND_API_KEY not configured");
  return { sent: false };
}

function devFallback(to: string, resetUrl: string): { sent: false; devUrl: string } {
  logger.warn({ to }, "Email sending skipped — RESEND_API_KEY not configured");
  console.log("\n========================================");
  console.log(`DEV: Password reset link for ${to}`);
  console.log(resetUrl);
  console.log("========================================\n");
  return { sent: false, devUrl: resetUrl };
}

// ---------------------------------------------------------------------------
// Setup reminder email
// ---------------------------------------------------------------------------

function buildReminderEmailHtml(name: string, quizUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080c14;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#0f1520;border-radius:16px;border:1px solid #1e2a40;overflow:hidden;max-width:520px;width:100%;">

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a40;">
          <span style="font-family:Georgia,serif;font-size:22px;color:#2d7dff;letter-spacing:0.02em;">🎾 Padel Concierge</span>
        </td></tr>

        <!-- English -->
        <tr><td style="padding:32px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Complete your player profile, ${name}</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">
            You're almost on the court! Take the quick assessment (about 2 minutes) to unlock
            smart matchmaking and get paired with the right partners for your level and playing style.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:10px;background:#2d7dff;">
              <a href="${quizUrl}"
                 style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Complete My Profile →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;font-size:13px;color:#4d5f7c;line-height:1.5;">
            If you no longer wish to receive emails like this, simply ignore it — we won't send another.
          </p>
        </td></tr>

        <!-- Divider -->
        <tr><td style="padding:0 40px;"><div style="border-top:1px solid #1e2a40;"></div></td></tr>

        <!-- Russian -->
        <tr><td style="padding:32px 40px 0;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Завершите настройку профиля, ${name}</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">
            Вы почти на корте! Пройдите короткий тест (около 2 минут), чтобы активировать
            умный подбор партнёров под ваш уровень и стиль игры.
          </p>
          <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
            <tr><td style="border-radius:10px;background:#1a2d52;border:1px solid #2d7dff;">
              <a href="${quizUrl}"
                 style="display:inline-block;padding:14px 32px;color:#7ab3ff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">
                Завершить профиль →
              </a>
            </td></tr>
          </table>
          <p style="margin:0 0 32px;font-size:13px;color:#4d5f7c;line-height:1.5;">
            Если вы не хотите получать такие письма — просто проигнорируйте его. Мы больше не будем отправлять напоминания.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:0 40px 32px;">
          <div style="border-top:1px solid #1e2a40;padding-top:24px;">
            <p style="margin:0;font-size:12px;color:#3a4a63;line-height:1.6;">
              Padel Concierge · Dubai Private Members Club<br/>
              <span style="word-break:break-all;color:#2a3a52;">${quizUrl}</span>
            </p>
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Send a one-time setup-reminder email to a player who registered but never
 * completed the archetype quiz.
 *
 * Returns:
 *   { sent: true }                   — email dispatched via Resend
 *   { sent: false, devUrl: string }  — no provider configured; URL logged
 */
export async function sendSetupReminderEmail(
  to: string,
  name: string,
): Promise<{ sent: boolean; devUrl?: string }> {
  const quizUrl = `${APP_URL}/assessment`;
  const subject = "Finish setting up your Padel Concierge profile / Завершите настройку профиля";
  const html = buildReminderEmailHtml(name, quizUrl);

  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) {
        logger.error({ err: error, to }, "Resend error sending reminder — falling back to dev mode");
        return reminderDevFallback(to, name, quizUrl);
      }
      logger.info({ to }, "Setup reminder email sent via Resend");
      return { sent: true };
    } catch (err) {
      logger.error({ err, to }, "Resend exception sending reminder — falling back to dev mode");
      return reminderDevFallback(to, name, quizUrl);
    }
  }

  return reminderDevFallback(to, name, quizUrl);
}

// ---------------------------------------------------------------------------
// Invite (magic-link onboarding) email
// ---------------------------------------------------------------------------

function buildInviteEmailHtml(name: string, inviteUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080c14;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#0f1520;border-radius:16px;border:1px solid #1e2a40;overflow:hidden;max-width:520px;width:100%;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a40;">
<span style="font-family:Georgia,serif;font-size:22px;color:#D4AF37;letter-spacing:0.02em;">🎾 Padel Concierge</span>
</td></tr>
<tr><td style="padding:32px 40px 0;">
<h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Welcome, ${name}</h2>
<p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">Your coach has added you to Padel Concierge — Dubai's private padel matchmaking club. Click below to set your password and step on the court.</p>
<p style="margin:0 0 8px;font-size:13px;color:#4d5f7c;">This invite link expires in 7 days.</p>
<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:10px;background:#D4AF37;">
<a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;color:#000;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Activate my account →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px;"><div style="border-top:1px solid #1e2a40;"></div></td></tr>
<tr><td style="padding:32px 40px 0;">
<h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">Добро пожаловать, ${name}</h2>
<p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;">Тренер добавил вас в Padel Concierge — закрытый клуб по подбору партнёров в Дубае. Нажмите кнопку, чтобы задать пароль и выйти на корт.</p>
<p style="margin:0 0 8px;font-size:13px;color:#4d5f7c;">Ссылка действительна 7 дней.</p>
<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:10px;background:#1a2d52;border:1px solid #D4AF37;">
<a href="${inviteUrl}" style="display:inline-block;padding:14px 32px;color:#D4AF37;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">Активировать аккаунт →</a>
</td></tr></table>
</td></tr>
<tr><td style="padding:0 40px 32px;"><div style="border-top:1px solid #1e2a40;padding-top:24px;">
<p style="margin:0;font-size:12px;color:#3a4a63;line-height:1.6;">Padel Concierge · Dubai Private Members Club<br/><span style="word-break:break-all;color:#2a3a52;">${inviteUrl}</span></p>
</div></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendInviteEmail(
  to: string,
  name: string,
  inviteUrl: string,
): Promise<{ sent: boolean; devUrl?: string }> {
  const subject = "Welcome to Padel Concierge / Добро пожаловать";
  const html = buildInviteEmailHtml(name, inviteUrl);

  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(RESEND_API_KEY);
      const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
      if (error) {
        logger.error({ err: error, to }, "Resend error sending invite — dev fallback");
        return inviteDevFallback(to, inviteUrl);
      }
      logger.info({ to }, "Invite email sent via Resend");
      return { sent: true };
    } catch (err) {
      logger.error({ err, to }, "Resend exception sending invite — dev fallback");
      return inviteDevFallback(to, inviteUrl);
    }
  }
  return inviteDevFallback(to, inviteUrl);
}

// ---------------------------------------------------------------------------
// Trainer match request notification email
// ---------------------------------------------------------------------------

export interface TrainerMatchRequestEmailParams {
  requesterName: string;
  format: string;
  venue: string;
  requestedDate: string;
  requestedTime: string;
  notes?: string | null;
}

function buildTrainerMatchRequestHtml(p: TrainerMatchRequestEmailParams): string {
  const url = `${APP_URL}/coach`;
  const notesBlock = p.notes
    ? `<p style="margin:0 0 8px;font-size:14px;color:#8a9ab8;line-height:1.6;"><strong style="color:#e8eaf0;">Notes:</strong> ${escapeHtml(p.notes)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#080c14;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#080c14;padding:40px 16px;"><tr><td align="center">
<table width="520" cellpadding="0" cellspacing="0" style="background:#0f1520;border-radius:16px;border:1px solid #1e2a40;overflow:hidden;max-width:520px;width:100%;">
<tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a40;">
<span style="font-family:Georgia,serif;font-size:22px;color:#2d7dff;letter-spacing:0.02em;">🎾 Padel Concierge</span>
</td></tr>
<tr><td style="padding:32px 40px 0;">
<h2 style="margin:0 0 12px;font-size:20px;color:#e8eaf0;font-weight:600;">New trainer match request</h2>
<p style="margin:0 0 8px;font-size:15px;color:#8a9ab8;line-height:1.6;"><strong style="color:#e8eaf0;">${escapeHtml(p.requesterName)}</strong> wants a match.</p>
<p style="margin:0 0 8px;font-size:14px;color:#8a9ab8;line-height:1.6;"><strong style="color:#e8eaf0;">When:</strong> ${escapeHtml(p.requestedDate)} at ${escapeHtml(p.requestedTime)}</p>
<p style="margin:0 0 8px;font-size:14px;color:#8a9ab8;line-height:1.6;"><strong style="color:#e8eaf0;">Format:</strong> ${escapeHtml(p.format)} · <strong style="color:#e8eaf0;">Venue:</strong> ${escapeHtml(p.venue)}</p>
${notesBlock}
<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td style="border-radius:10px;background:#2d7dff;">
<a href="${url}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">Open coach dashboard →</a>
</td></tr></table>
<p style="margin:0 0 24px;font-size:12px;color:#3a4a63;line-height:1.5;">You're receiving this because you're a trainer on Padel Concierge. To stop these emails, turn off "Trainer match request emails" in your profile settings.</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendTrainerMatchRequestEmail(
  to: string,
  params: TrainerMatchRequestEmailParams,
): Promise<{ sent: boolean }> {
  const subject = `New trainer match request — ${params.requesterName} · ${params.requestedDate} ${params.requestedTime}`;
  const html = buildTrainerMatchRequestHtml(params);
  return sendNotificationEmail(to, subject, html);
}

function inviteDevFallback(to: string, inviteUrl: string): { sent: false; devUrl: string } {
  logger.warn({ to }, "Invite email skipped — RESEND_API_KEY not configured");
  console.log("\n========================================");
  console.log(`DEV: Invite link for ${to}`);
  console.log(inviteUrl);
  console.log("========================================\n");
  return { sent: false, devUrl: inviteUrl };
}

function reminderDevFallback(to: string, name: string, quizUrl: string): { sent: false; devUrl: string } {
  logger.warn({ to, name }, "Email sending skipped — RESEND_API_KEY not configured");
  console.log("\n========================================");
  console.log(`DEV: Setup reminder for ${name} <${to}>`);
  console.log(`Quiz URL: ${quizUrl}`);
  console.log("========================================\n");
  return { sent: false, devUrl: quizUrl };
}
