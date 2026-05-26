import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock @workspace/db ──────────────────────────────────────────────────────
//
// Each route reads/writes the DB via a chainable thenable returned from
// drizzle's `db.select(...)` / `db.insert(...)`. We queue per-test results so
// that each successive call resolves to the next queued value.

const dbResults: unknown[][] = [];

function pushResult(rows: unknown[]): void {
  dbResults.push(rows);
}

function shiftResult(): unknown[] {
  return dbResults.shift() ?? [];
}

function makeChain(getRows: () => unknown[]): any {
  const chain: any = {};
  const passthrough = () => chain;
  for (const m of ["from", "where", "orderBy", "limit", "offset", "groupBy", "leftJoin", "innerJoin", "set", "values", "onConflictDoNothing", "onConflictDoUpdate"]) {
    chain[m] = vi.fn(passthrough);
  }
  chain.returning = vi.fn(() => {
    const rows = getRows();
    return Promise.resolve(rows);
  });
  chain.then = (resolve: any, reject: any) => {
    const rows = getRows();
    return Promise.resolve(rows).then(resolve, reject);
  };
  chain.catch = (reject: any) => Promise.resolve(getRows()).catch(reject);
  chain.finally = (cb: any) => Promise.resolve(getRows()).finally(cb);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain(shiftResult)),
  insert: vi.fn(() => makeChain(shiftResult)),
  update: vi.fn(() => makeChain(shiftResult)),
  delete: vi.fn(() => makeChain(shiftResult)),
};

vi.mock("@workspace/db", async () => {
  // Provide table objects, the singleton db/pool, and the behavioral helpers
  // used by routes touched by the LEVEL_REQUIRED guard.
  const passthrough = new Proxy({}, { get: () => () => undefined });
  const tableNames = [
    "usersTable",
    "matchRequestsTable",
    "activityLogsTable",
    "matchesTable",
    "trainerMatchRequestsTable",
    "matchFeedbackTable",
    "coachingClientsTable",
    "videoAnalysesTable",
    "reminderLogsTable",
    "bookingsTable",
    "padelNewsTable",
    "padelRulesTable",
    "notificationsTable",
    "passwordResetTokensTable",
    "courtsTable",
    "courtBookingsTable",
    "skillAssessmentsTable",
    "coachingSessionsTable",
    "postMatchNotesTable",
    "coachingMessagesTable",
    "recurringSchedulesTable",
    "recurringSeriesTable",
    "groupTrainingsTable",
    "trainingBookingsTable",
    "compatibilityScoresTable",
    "feedbackAggregatesTable",
    "matchLogsTable",
    "playerProfilesTable",
    "pfQuizResultsTable",
    "pfUsersTable",
  ];
  const tables: Record<string, unknown> = {};
  for (const t of tableNames) tables[t] = passthrough;

  return {
    db: mockDb,
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
    ...tables,
    // Behavioral helpers
    getOrCreateProfile: vi.fn().mockResolvedValue(null),
    computeAndCacheCompatibility: vi.fn().mockResolvedValue({ score: 75 }),
    patchPlayerProfile: vi.fn().mockResolvedValue(undefined),
    upsertMatchLog: vi.fn().mockResolvedValue(undefined),
    upsertProfileMatchRecord: vi.fn().mockResolvedValue(undefined),
    appendMatchTimeline: vi.fn().mockResolvedValue(undefined),
    recordNoShow: vi.fn().mockResolvedValue(undefined),
    recordAttendance: vi.fn().mockResolvedValue(undefined),
    upsertFeedbackAggregate: vi.fn().mockResolvedValue(undefined),
  };
});

// Now safe to import app + helpers (they import the mocked module).
const { default: app } = await import("../../app");
const { generateToken } = await import("../../lib/auth");
const request = (await import("supertest")).default;

const PLAYER_ID = 42;
const playerToken = generateToken(PLAYER_ID, "player");
const auth = `Bearer ${playerToken}`;

const userWithoutLevel = {
  id: PLAYER_ID,
  name: "Test Player",
  level: null,
  archetype: null,
  role: "player",
  verified: true,
  approvalStatus: "approved",
  userType: "real_user",
  availability: "[]",
};

const userWithLevel = {
  ...userWithoutLevel,
  level: "C",
};

beforeEach(() => {
  dbResults.length = 0;
});

describe("LEVEL_REQUIRED guard", () => {
  describe("POST /api/matchmaking/suggest", () => {
    it("rejects players whose level is null with 400 LEVEL_REQUIRED", async () => {
      pushResult([userWithoutLevel]); // db.select().from(usersTable) -> allUsers

      const res = await request(app)
        .post("/api/matchmaking/suggest")
        .set("Authorization", auth)
        .send({ count: 5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("rejects players whose level is empty string with 400 LEVEL_REQUIRED", async () => {
      pushResult([{ ...userWithoutLevel, level: "   " }]);

      const res = await request(app)
        .post("/api/matchmaking/suggest")
        .set("Authorization", auth)
        .send({ count: 5 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("allows players with a level set (2xx)", async () => {
      pushResult([userWithLevel]); // allUsers query

      const res = await request(app)
        .post("/api/matchmaking/suggest")
        .set("Authorization", auth)
        .send({ count: 5 });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.code).not.toBe("LEVEL_REQUIRED");
    });
  });

  describe("POST /api/match-requests", () => {
    it("rejects sender with null level with 400 LEVEL_REQUIRED", async () => {
      pushResult([userWithoutLevel]); // from
      pushResult([{ id: 99, name: "Other", level: "B" }]); // to

      const res = await request(app)
        .post("/api/match-requests")
        .set("Authorization", auth)
        .send({ toUserId: 99 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("rejects sender with empty-string level with 400 LEVEL_REQUIRED", async () => {
      pushResult([{ ...userWithoutLevel, level: "" }]);
      pushResult([{ id: 99, name: "Other", level: "B" }]);

      const res = await request(app)
        .post("/api/match-requests")
        .set("Authorization", auth)
        .send({ toUserId: 99 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("allows sender with a level set (2xx)", async () => {
      const toUser = { id: 99, name: "Other", level: "B" };
      pushResult([userWithLevel]); // from
      pushResult([toUser]); // to
      pushResult([{ id: 1, fromUserId: PLAYER_ID, toUserId: 99, message: null, status: "pending", proposedDate: null, proposedTime: null, matchId: null, createdAt: new Date(), updatedAt: new Date() }]); // insert returning
      pushResult([]); // activity logs insert
      pushResult([userWithLevel]); // formatRequest: from
      pushResult([toUser]); // formatRequest: to

      const res = await request(app)
        .post("/api/match-requests")
        .set("Authorization", auth)
        .send({ toUserId: 99 });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.code).not.toBe("LEVEL_REQUIRED");
    });
  });

  describe("POST /api/trainer-match-requests", () => {
    it("rejects player with null level with 400 LEVEL_REQUIRED", async () => {
      pushResult([{ level: null }]); // player lookup

      const res = await request(app)
        .post("/api/trainer-match-requests")
        .set("Authorization", auth)
        .send({ requestedDate: "2026-06-01", requestedTime: "18:00" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("rejects player with empty-string level with 400 LEVEL_REQUIRED", async () => {
      pushResult([{ level: "" }]);

      const res = await request(app)
        .post("/api/trainer-match-requests")
        .set("Authorization", auth)
        .send({ requestedDate: "2026-06-01", requestedTime: "18:00" });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("allows player with a level set (2xx)", async () => {
      pushResult([{ level: "C" }]); // player lookup
      pushResult([{ id: 1, playerId: PLAYER_ID, format: "4v4", venue: "Padel Edition", requestedDate: "2026-06-01", requestedTime: "18:00", notes: "", status: "pending" }]); // insert returning

      const res = await request(app)
        .post("/api/trainer-match-requests")
        .set("Authorization", auth)
        .send({ requestedDate: "2026-06-01", requestedTime: "18:00" });

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.code).not.toBe("LEVEL_REQUIRED");
    });
  });

  describe("GET /api/users/find-matches", () => {
    it("rejects players with null level with 400 LEVEL_REQUIRED", async () => {
      pushResult([userWithoutLevel]); // me lookup

      const res = await request(app)
        .get("/api/users/find-matches")
        .set("Authorization", auth);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("rejects players with empty-string level with 400 LEVEL_REQUIRED", async () => {
      pushResult([{ ...userWithoutLevel, level: "  " }]);

      const res = await request(app)
        .get("/api/users/find-matches")
        .set("Authorization", auth);

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("LEVEL_REQUIRED");
    });

    it("allows players with a level set (2xx)", async () => {
      pushResult([userWithLevel]); // me lookup
      pushResult([userWithLevel]); // allUsers

      const res = await request(app)
        .get("/api/users/find-matches")
        .set("Authorization", auth);

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.code).not.toBe("LEVEL_REQUIRED");
    });
  });
});
