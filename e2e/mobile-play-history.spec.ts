import { test, expect, request as pwRequest, type Page } from "@playwright/test";
import { Client } from "pg";

const PLAYER_EMAIL = "player@padelconcierge.com";
const PLAYER_PASSWORD = "player123";

// The Expo mobile app bypasses the shared proxy (router = "expo-domain"): its HTML
// references the JS bundle with a root-relative path, so it only executes on the
// Expo dev domain — NOT on the regular dev domain under /mobile/ (the bundle 404s
// there and the page stays blank). Drive the UI against this host.
const EXPO_DOMAIN = process.env.REPLIT_EXPO_DEV_DOMAIN;
const EXPO_BASE = EXPO_DOMAIN ? `https://${EXPO_DOMAIN}` : "";

async function pg() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set for e2e test");
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

// The Expo web bundle can render blank while Metro compiles on a cold hit. Load
// the app root and wait for the login screen, reloading once if it's slow.
async function openAppRoot(page: Page) {
  await page.goto(`${EXPO_BASE}/`, { waitUntil: "domcontentloaded" });
  const email = page.getByTestId("email-input");
  try {
    await expect(email).toBeVisible({ timeout: 45_000 });
  } catch {
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(email).toBeVisible({ timeout: 60_000 });
  }
}

test.describe("Mobile Play hub — past matches history", () => {
  let playerId: number;
  let completedId: number;
  let cancelledId: number;

  test.beforeAll(async ({ baseURL }) => {
    if (!EXPO_BASE) return;

    const api = await pwRequest.newContext({ baseURL });
    const login = await api.post("/api/auth/login", {
      data: { email: PLAYER_EMAIL, password: PLAYER_PASSWORD },
    });
    expect(login.status(), `player login failed: ${await login.text()}`).toBe(200);
    playerId = ((await login.json()) as { user: { id: number } }).user.id;
    await api.dispose();

    // Seed two finished play matches the player belongs to so the history view has
    // deterministic data for both branches: a completed match (set scores shown)
    // and a cancelled match ("not played"). Cleaned up in afterAll.
    const db = await pg();
    try {
      const completed = await db.query(
        `INSERT INTO matches
           (date, time, club_name, format, status, match_kind, visibility, max_players, creator_id, set_scores, overall_note)
         VALUES ($1, $2, $3, 'Classic', 'completed', 'competitive', 'private', 4, $4, $5, 'E2E completed match')
         RETURNING id`,
        [
          "2026-05-01",
          "18:00",
          "E2E History Club",
          playerId,
          JSON.stringify([
            { setNumber: 1, teamA: 6, teamB: 4 },
            { setNumber: 2, teamA: 6, teamB: 3 },
          ]),
        ],
      );
      completedId = completed.rows[0].id as number;

      const cancelled = await db.query(
        `INSERT INTO matches
           (date, time, club_name, format, status, match_kind, visibility, max_players, creator_id)
         VALUES ($1, $2, $3, 'Simplified', 'cancelled', 'unranked', 'private', 4, $4)
         RETURNING id`,
        ["2026-05-02", "19:00", "E2E History Club", playerId],
      );
      cancelledId = cancelled.rows[0].id as number;

      await db.query(
        `INSERT INTO match_participants (match_id, user_id, role)
         VALUES ($1, $3, 'leader'), ($2, $3, 'leader')`,
        [completedId, cancelledId, playerId],
      );
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    if (!EXPO_BASE) return;
    const ids = [completedId, cancelledId].filter((x): x is number => typeof x === "number");
    if (ids.length === 0) return;
    const db = await pg();
    try {
      await db.query("DELETE FROM match_participants WHERE match_id = ANY($1)", [ids]);
      await db.query("DELETE FROM matches WHERE id = ANY($1)", [ids]);
    } finally {
      await db.end();
    }
  });

  test("player logs in, sees past matches, and opens a match detail", async ({ browser }) => {
    test.skip(!EXPO_BASE, "REPLIT_EXPO_DEV_DOMAIN not set; Expo web host unavailable");

    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // 1. Warm up the Expo bundle and land on the login screen.
      await openAppRoot(page);

      // 2. Log in as the player.
      await page.getByTestId("email-input").fill(PLAYER_EMAIL);
      await page.getByTestId("password-input").fill(PLAYER_PASSWORD);
      await page.getByTestId("login-button").click();

      // Wait until we leave the login screen (session established in AsyncStorage).
      await expect(page.getByTestId("login-button")).toBeHidden({ timeout: 30_000 });

      // 3. Open the Play hub. The persisted token keeps the session through nav.
      await page.goto(`${EXPO_BASE}/play`, { waitUntil: "domcontentloaded" });

      // 4. The "Past matches" section renders our seeded cancelled + completed cards.
      const cancelledCard = page.getByTestId(`history-match-${cancelledId}`);
      const completedCard = page.getByTestId(`history-match-${completedId}`);
      await expect(cancelledCard).toBeVisible({ timeout: 45_000 });
      await expect(completedCard).toBeVisible();

      // 5. The completed card shows the full formatted set scores. The score is
      //    rendered as "teamA-teamB" joined by " · ", so both sets must appear
      //    (language-independent digits).
      await expect(completedCard.getByText(/6-4\s*·\s*6-3/)).toBeVisible();

      // 6. The completed card shows the winning-side label. The server derives
      //    winningSide from the set scores: teamA took both sets (6-4, 6-3) so
      //    side "A" wins, rendering resultWinnerA. The player account renders in
      //    Russian, but match any locale's label for robustness.
      await expect(
        completedCard.getByText(/Победила команда A|Team A won|فاز الفريق A/),
      ).toBeVisible();

      // 7. The cancelled card shows the "not played" line instead of a score
      //    (the other history branch), so the two branches stay distinct.
      await expect(
        cancelledCard.getByText(/Не сыгран|Not played|لم تُلعب/),
      ).toBeVisible();

      // 8. Tapping a past-match card navigates into its detail screen.
      await completedCard.click();
      await page.waitForURL(`**/play/match/${completedId}`, { timeout: 20_000 });
      expect(page.url()).toContain(`/play/match/${completedId}`);
    } finally {
      await context.close();
    }
  });
});
