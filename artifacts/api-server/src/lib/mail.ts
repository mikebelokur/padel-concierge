import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<boolean> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("SMTP not configured — password reset email not sent");
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;
  try {
    await transport.sendMail({
      from,
      to,
      subject: "Reset your Padel Concierge password",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#080c14;color:#e8eaf0;padding:32px;border-radius:12px;">
          <h2 style="font-family:Georgia,serif;color:#2d7dff;margin-top:0;">Padel Concierge</h2>
          <p>You requested a password reset. Click the button below to set a new password. This link expires in 1 hour.</p>
          <a href="${resetUrl}" style="display:inline-block;background:#2d7dff;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0;">
            Reset Password
          </a>
          <p style="color:#6b7a99;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    logger.error({ err }, "Failed to send password reset email");
    return false;
  }
}
