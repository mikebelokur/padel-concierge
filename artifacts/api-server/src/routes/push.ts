import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { getVapidPublicKey, isPushConfigured } from "../lib/push";

const router: IRouter = Router();

router.get("/push/vapid-public-key", (_req, res): void => {
  res.json({
    publicKey: getVapidPublicKey(),
    configured: isPushConfigured(),
  });
});

const SubscribeBody = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

router.post("/push/subscribe", requireAuth, async (req, res): Promise<void> => {
  const userId: number = (req as unknown as { auth: { userId: number } }).auth.userId;
  const parsed = SubscribeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { endpoint, keys, userAgent } = parsed.data;

  const [existing] = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint));

  if (existing) {
    const [row] = await db
      .update(pushSubscriptionsTable)
      .set({
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent ?? existing.userAgent ?? null,
      })
      .where(eq(pushSubscriptionsTable.id, existing.id))
      .returning();
    res.json({ id: row.id, updated: true });
    return;
  }

  const [row] = await db
    .insert(pushSubscriptionsTable)
    .values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: userAgent ?? null,
    })
    .returning();
  res.status(201).json({ id: row.id, created: true });
});

const UnsubscribeBody = z.object({ endpoint: z.string().url() });

router.post(
  "/push/unsubscribe",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId: number = (req as unknown as { auth: { userId: number } }).auth.userId;
    const parsed = UnsubscribeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    await db
      .delete(pushSubscriptionsTable)
      .where(
        and(
          eq(pushSubscriptionsTable.endpoint, parsed.data.endpoint),
          eq(pushSubscriptionsTable.userId, userId),
        ),
      );
    res.json({ ok: true });
  },
);

export default router;
