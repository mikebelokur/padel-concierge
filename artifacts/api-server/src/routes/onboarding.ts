import { Router, type IRouter } from "express";
import { db, playerProfilesTable, usersTable, activityLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";

const router: IRouter = Router();
router.use(requireAuth);

// Allowed values for the Welcome questionnaire (Stage 1). Kept in sync with the
// frontend i18n option keys in artifacts/padel-concierge/src/pages/welcome.tsx.
const GENDERS = ["female", "male", "other", "prefer_not"] as const;
const AGE_RANGES = ["18-25", "26-35", "36-45", "46-55", "55+"] as const;
const EXPERIENCE = ["<6m", "6-12m", "1-3y", "3-5y", "5+"] as const;
const LIMITATIONS = ["none", "back", "knees", "shoulder", "unsure"] as const;
const COMM_STYLES = ["direct", "supportive", "analytical", "motivating", "unsure"] as const;

const WelcomeBody = z.object({
  gender: z.enum(GENDERS).optional(),
  ageRange: z.enum(AGE_RANGES).optional(),
  experienceYears: z.enum(EXPERIENCE).optional(),
  limitations: z.array(z.enum(LIMITATIONS)).max(5).optional().default([]),
  communicationStyle: z.enum(COMM_STYLES).optional(),
});

// Completing onboarding nudges matchmaking compatibility (Stage 1 seed).
const WELCOME_BONUS = 5;

// GET /onboarding/welcome — current onboarding answers for prefill / status.
router.get("/onboarding/welcome", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;
  const [profile] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));

  res.json({
    completed: !!profile?.welcomeCompletedAt,
    gender: profile?.gender ?? null,
    ageRange: profile?.ageRange ?? null,
    experienceYears: profile?.experienceYears ?? null,
    limitations: profile?.limitations ?? [],
    communicationStyle: profile?.communicationStyle ?? null,
  });
});

// POST /onboarding/welcome — save the questionnaire for the authenticated user.
router.post("/onboarding/welcome", async (req, res): Promise<void> => {
  const userId: number = (req as any).auth.userId;

  const parsed = WelcomeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid welcome payload" });
    return;
  }
  const data = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [existing] = await db
    .select()
    .from(playerProfilesTable)
    .where(eq(playerProfilesTable.userId, userId));

  // Only award the compatibility bonus on the FIRST completion (idempotent edits).
  const firstCompletion = !existing?.welcomeCompletedAt;

  const fields = {
    gender: data.gender ?? null,
    ageRange: data.ageRange ?? null,
    experienceYears: data.experienceYears ?? null,
    limitations: data.limitations ?? [],
    communicationStyle: data.communicationStyle ?? null,
    welcomeCompletedAt: new Date(),
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(playerProfilesTable)
      .set({
        ...fields,
        ...(firstCompletion
          ? { compatibilityBias: sql`${playerProfilesTable.compatibilityBias} + ${WELCOME_BONUS}` }
          : {}),
      })
      .where(eq(playerProfilesTable.userId, userId));
  } else {
    await db.insert(playerProfilesTable).values({
      userId,
      ...fields,
      compatibilityBias: WELCOME_BONUS,
    });
  }

  if (firstCompletion) {
    await db.insert(activityLogsTable).values({
      userId: user.id,
      userName: user.name,
      action: "welcome_completed",
      details: "Welcome onboarding questionnaire completed",
      detailsParams: { gender: data.gender ?? null, ageRange: data.ageRange ?? null },
    });
  }

  res.status(firstCompletion ? 201 : 200).json({ completed: true });
});

export default router;
