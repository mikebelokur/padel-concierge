/**
 * Task #145 — end-to-end-style integration coverage for:
 *   (1) coach/admin → invite → password set → dashboard (member number)
 *   (2) booking gated by group-training registration window
 *       (scheduled → 409, open → 201, closed → 409)
 *
 * These run against the real Express app via supertest with the DB mocked
 * the same way as level_required.test.ts — predictable, no live Postgres
 * needed, deterministic in CI.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const dbResults: unknown[][] = [];
const txResults: unknown[][] = [];
const insertCalls: { table: string; rows: unknown[] }[] = [];

function pushResult(rows: unknown[]): void {
  dbResults.push(rows);
}
function pushTxResult(rows: unknown[]): void {
  txResults.push(rows);
}

function makeChain(getRows: () => unknown[], recordValues?: (rows: unknown[]) => void): any {
  const chain: any = {};
  const passthrough = () => chain;
  for (const m of [
    "from", "where", "orderBy", "limit", "offset", "groupBy",
    "leftJoin", "innerJoin", "set", "onConflictDoNothing", "onConflictDoUpdate",
  ]) {
    chain[m] = vi.fn(passthrough);
  }
  chain.values = vi.fn((rows: unknown) => {
    if (recordValues) recordValues(Array.isArray(rows) ? rows : [rows]);
    return chain;
  });
  chain.returning = vi.fn(() => Promise.resolve(getRows()));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(getRows()).then(resolve, reject);
  chain.catch = (reject: any) => Promise.resolve(getRows()).catch(reject);
  chain.finally = (cb: any) => Promise.resolve(getRows()).finally(cb);
  return chain;
}

const mockDb = {
  select: vi.fn(() => makeChain(() => dbResults.shift() ?? [])),
  insert: vi.fn(() => makeChain(
    () => dbResults.shift() ?? [],
    (rows) => insertCalls.push({ table: "?", rows }),
  )),
  update: vi.fn(() => makeChain(() => dbResults.shift() ?? [])),
  delete: vi.fn(() => makeChain(() => dbResults.shift() ?? [])),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    // Each transaction gets a tx object backed by txResults. The lock query
    // uses tx.execute() and returns { rows: [...] }; other queries reuse
    // the same queue.
    const tx: any = {
      execute: vi.fn(async () => ({ rows: txResults.shift() ?? [] })),
      select: vi.fn(() => makeChain(() => txResults.shift() ?? [])),
      insert: vi.fn(() => makeChain(
        () => txResults.shift() ?? [],
        (rows) => insertCalls.push({ table: "tx?", rows }),
      )),
      update: vi.fn(() => makeChain(() => txResults.shift() ?? [])),
      delete: vi.fn(() => makeChain(() => txResults.shift() ?? [])),
    };
    return fn(tx);
  }),
};

vi.mock("@workspace/db", async () => {
  const passthrough = new Proxy({}, { get: () => () => undefined });
  const tableNames = [
    "usersTable", "matchRequestsTable", "activityLogsTable", "matchesTable",
    "trainerMatchRequestsTable", "matchFeedbackTable", "coachingClientsTable",
    "videoAnalysesTable", "reminderLogsTable", "bookingsTable",
    "padelNewsTable", "padelRulesTable", "notificationsTable",
    "passwordResetTokensTable", "courtsTable", "courtBookingsTable",
    "skillAssessmentsTable", "coachingSessionsTable", "postMatchNotesTable",
    "coachingMessagesTable", "recurringSchedulesTable", "recurringSeriesTable",
    "groupTrainingsTable", "trainingBookingsTable", "compatibilityScoresTable",
    "feedbackAggregatesTable", "matchLogsTable", "playerProfilesTable",
    "pfQuizResultsTable", "pfUsersTable",
  ];
  const tables: Record<string, unknown> = {};
  for (const t of tableNames) tables[t] = passthrough;
  return {
    db: mockDb,
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
    ...tables,
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

vi.mock("../../lib/mail", () => ({
  sendInviteEmail: vi.fn(async () => ({ sent: true })),
  sendNotificationEmail: vi.fn(async () => ({ sent: true })),
  sendVerificationEmail: vi.fn(async () => ({ sent: true })),
  sendPasswordResetEmail: vi.fn(async () => ({ sent: true })),
}));

const { default: app } = await import("../../app");
const { generateToken, verifyToken, hashPassword } = await import("../../lib/auth");
const request = (await import("supertest")).default;

const ADMIN_ID = 1;
const adminAuth = `Bearer ${generateToken(ADMIN_ID, "admin")}`;

const PLAYER_ID = 42;
const playerAuth = `Bearer ${generateToken(PLAYER_ID, "player")}`;

beforeEach(() => {
  dbResults.length = 0;
  txResults.length = 0;
  insertCalls.length = 0;
  mockDb.select.mockClear();
  mockDb.insert.mockClear();
  mockDb.update.mockClear();
  mockDb.transaction.mockClear();
});

// ─── Invite flow ─────────────────────────────────────────────────────────────
describe("Invite + first-time activation flow", () => {
  it("admin creates user → invite URL is returned with a valid token", async () => {
    pushResult([]); // existing-email lookup → none
    pushResult([{ // insert returning user — formatUser dereferences a lot of fields
      id: 99, name: "New Member", email: "new@example.com", phone: "",
      passwordHash: "x", level: "C", role: "player", source: "coach_added",
      inviteStatus: "invited", inviteToken: "tok", inviteTokenExpiresAt: new Date(),
      approvalStatus: "approved", memberNumber: 1337, badge: null,
      goal: null, intensity: null, locationLat: null, locationLng: null,
      locationName: null, avatar: null, verified: false, verificationDate: null,
      favouritePlayers: [], availability: "[]", matchesPlayed: 0, wins: 0,
      language: "en", isOnline: false, lastActive: null,
      createdAt: new Date(), lastLogin: null, archetype: null,
      warmUpPreference: false, levelSelf: null, levelQuiz: null,
      physicalSelf: null, warmupFormat: null, userType: "real_user",
      reminderOptOut: false, coachingClientId: null,
    }]);
    pushResult([]); // activity_logs insert

    const res = await request(app)
      .post("/api/admin/users")
      .set("Authorization", adminAuth)
      .send({ name: "New Member", email: "new@example.com", level: "C", role: "player" });

    expect(res.status).toBe(201);
    expect(res.body.user.id).toBe(99);
    expect(res.body.user.memberNumber).toBe(1337);
    expect(res.body.inviteUrl).toMatch(/\/invite\/[0-9a-f-]{36}$/i);

    // The user row inserted must carry an invite token + 'invited' status.
    const userInsert = insertCalls.find((c) =>
      Array.isArray(c.rows) && c.rows[0] && (c.rows[0] as any).inviteStatus === "invited",
    );
    expect(userInsert).toBeDefined();
    const inserted = userInsert!.rows[0] as any;
    expect(inserted.inviteToken).toMatch(/^[0-9a-f-]{36}$/i);
    expect(inserted.inviteTokenExpiresAt).toBeInstanceOf(Date);
    expect(inserted.inviteTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("GET /api/invite/:token returns member info for a valid invite", async () => {
    const token = "11111111-2222-3333-4444-555555555555";
    pushResult([{
      id: 99, name: "New Member", email: "new@example.com",
      memberNumber: 1337, badge: null, inviteStatus: "invited",
      inviteTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    }]);

    const res = await request(app).get(`/api/invite/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.memberNumber).toBe(1337);
    expect(res.body.inviteStatus).toBe("invited");
    expect(res.body.email).toBe("new@example.com");
  });

  it("GET /api/invite/:token returns 404 for a malformed (non-uuid) token", async () => {
    const res = await request(app).get(`/api/invite/not-a-uuid`);
    expect(res.status).toBe(404);
  });

  it("POST /api/invite/:token/accept sets password, activates account, returns auth token", async () => {
    const token = "11111111-2222-3333-4444-555555555555";
    const baseUser = {
      id: 99, name: "New Member", email: "new@example.com", phone: "",
      passwordHash: "x", level: "C", role: "player", source: "coach_added",
      inviteStatus: "invited", inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60),
      approvalStatus: "approved", memberNumber: 1337, badge: null,
      goal: null, intensity: null, locationLat: null, locationLng: null,
      locationName: null, avatar: null, verified: false, verificationDate: null,
      favouritePlayers: [], availability: "[]", matchesPlayed: 0, wins: 0,
      language: "en", isOnline: false, lastActive: null,
      createdAt: new Date(), lastLogin: null, archetype: null,
      warmUpPreference: false, levelSelf: null, levelQuiz: null,
      physicalSelf: null, warmupFormat: null, userType: "real_user",
      reminderOptOut: false, coachingClientId: null,
    };
    pushResult([baseUser]); // lookup-by-token
    pushResult([{ ...baseUser, inviteStatus: "activated", inviteToken: null, inviteTokenExpiresAt: null, passwordHash: hashPassword("Brandnew!23"), lastLogin: new Date(), isOnline: true, lastActive: new Date() }]); // update returning
    pushResult([]); // activity log insert

    const res = await request(app)
      .post(`/api/invite/${token}/accept`)
      .send({ password: "Brandnew!23" });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.id).toBe(99);
    expect(res.body.user.memberNumber).toBe(1337);

    // Returned auth token is a real JWT for this user — what the frontend
    // hands to AuthContext.login() and then uses to render /dashboard.
    const decoded = verifyToken(res.body.token);
    expect(decoded).toEqual(expect.objectContaining({ userId: 99, role: "player" }));

    // The update payload must clear the invite token and flip status.
    const updateSet = mockDb.update.mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0];
    expect(updateSet).toMatchObject({
      inviteStatus: "activated",
      inviteToken: null,
      inviteTokenExpiresAt: null,
    });
    expect(typeof updateSet.passwordHash).toBe("string");
    expect(updateSet.passwordHash.length).toBeGreaterThan(20);
  });

  it("POST /api/invite/:token/accept rejects passwords shorter than 8 chars", async () => {
    const token = "11111111-2222-3333-4444-555555555555";
    const res = await request(app)
      .post(`/api/invite/${token}/accept`)
      .send({ password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/8 char/i);
  });

  it("POST /api/invite/:token/accept returns 404 when the token doesn't match", async () => {
    const token = "11111111-2222-3333-4444-555555555555";
    pushResult([]); // no matching user
    const res = await request(app)
      .post(`/api/invite/${token}/accept`)
      .send({ password: "Brandnew!23" });
    expect(res.status).toBe(404);
  });
});

// ─── Registration window enforcement ─────────────────────────────────────────
describe("Group training registration window enforcement", () => {
  // Real v4 uuid — Zod's UuidSchema enforces version + variant nibbles.
  const TRAINING_ID = "9b8c7a6d-4e5f-4a1b-9c2d-1234567890ab";
  const trainingBase = {
    id: TRAINING_ID,
    coachId: 1,
    dateTime: new Date(Date.now() + 30 * 60 * 60 * 1000), // 30h out
    durationMinutes: 90,
    category: "C",
    courtName: "E2E Court",
    courtAddress: null,
    maxParticipants: 4,
    priceAed: "120.00",
    descriptionEn: null,
    descriptionRu: null,
    isRecurring: false,
    recurringSeriesId: null,
    recurringPattern: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const playerLevelRow = { level: "C", name: "Test Player" };

  function seedPreTransaction(training: { status: string }): void {
    pushResult([{ ...trainingBase, status: training.status }]); // training lookup
    pushResult([playerLevelRow]); // player lookup
  }

  it("rejects booking with 409 reason=scheduled when window is 'scheduled'", async () => {
    seedPreTransaction({ status: "scheduled" });
    // Transaction: FOR UPDATE row lock returns status='scheduled'.
    pushTxResult([{ id: TRAINING_ID, max_participants: 4, status: "scheduled" }]);

    const res = await request(app)
      .post(`/api/group-trainings/${TRAINING_ID}/book`)
      .set("Authorization", playerAuth)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({
      reason: "scheduled",
      error: expect.stringMatching(/not open yet/i),
    }));
  });

  it("accepts booking with 201 when window is 'open'", async () => {
    seedPreTransaction({ status: "open" });
    pushTxResult([{ id: TRAINING_ID, max_participants: 4, status: "open" }]); // lock row
    pushTxResult([]); // existing-booking lookup → none
    pushTxResult([]); // active-count lookup → empty (0 booked)
    pushTxResult([{ // insert booking returning
      id: "bk-1", trainingId: TRAINING_ID, userId: PLAYER_ID, status: "booked",
      bookedAt: new Date(), cancelledAt: null, createdAt: new Date(),
    }]);
    pushResult([]); // post-tx activity log insert (uses db.insert, not tx.insert)

    const res = await request(app)
      .post(`/api/group-trainings/${TRAINING_ID}/book`)
      .set("Authorization", playerAuth)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("booked");
    expect(res.body.trainingId).toBe(TRAINING_ID);
  });

  it("rejects booking with 409 reason=closed when window is 'closed'", async () => {
    seedPreTransaction({ status: "closed" });
    pushTxResult([{ id: TRAINING_ID, max_participants: 4, status: "closed" }]);

    const res = await request(app)
      .post(`/api/group-trainings/${TRAINING_ID}/book`)
      .set("Authorization", playerAuth)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual(expect.objectContaining({
      reason: "closed",
      error: expect.stringMatching(/closed/i),
    }));
  });

  it("rejects booking when training row is missing (404)", async () => {
    pushResult([]); // training lookup → none
    const res = await request(app)
      .post(`/api/group-trainings/${TRAINING_ID}/book`)
      .set("Authorization", playerAuth)
      .send({});
    expect(res.status).toBe(404);
  });
});
