/**
 * Regression coverage for the masked, read-only training roster endpoint:
 *   GET /api/group-trainings/:id/roster
 *
 * Visibility rules under test (see group_trainings.ts roster handler):
 *   - coaches/admins/owners always see the roster
 *   - a player with an active (non-cancelled) booking sees it
 *   - a player without a booking sees it only when the training is open/full
 *     AND the player's level is eligible for the category
 *   - ineligible level → 403, non-open/no-booking → 404
 *   - unauthenticated → 401, malformed uuid → 400
 *   - names are masked to "First L." and the payload never leaks the full
 *     surname, phone, or email
 *
 * Runs against the real Express app via supertest with the DB mocked the same
 * way as level_required.test.ts — deterministic, no live Postgres needed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// ─── Mock @workspace/db ──────────────────────────────────────────────────────
// Each db.select(...) resolves to the next queued result, in call order.

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
  for (const m of [
    "from", "where", "orderBy", "limit", "offset", "groupBy",
    "leftJoin", "innerJoin", "set", "values", "onConflictDoNothing", "onConflictDoUpdate",
  ]) {
    chain[m] = vi.fn(passthrough);
  }
  chain.returning = vi.fn(() => Promise.resolve(getRows()));
  chain.then = (resolve: any, reject: any) =>
    Promise.resolve(getRows()).then(resolve, reject);
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
  const passthrough = new Proxy({}, { get: () => () => undefined });
  const tableNames = [
    "usersTable",
    "groupTrainingsTable",
    "trainingBookingsTable",
    "activityLogsTable",
    "notificationsTable",
    "clubsTable",
  ];
  const tables: Record<string, unknown> = {};
  for (const t of tableNames) tables[t] = passthrough;

  return {
    db: mockDb,
    pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
    ...tables,
  };
});

// Now safe to import app + helpers (they import the mocked module).
const { default: app } = await import("../../app");
const { generateToken } = await import("../../lib/auth");
const request = (await import("supertest")).default;

const TRAINING_ID = "11111111-1111-4111-8111-111111111111";

const coachToken = generateToken(7, "coach");
const playerToken = generateToken(42, "player");

function trainingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TRAINING_ID,
    coachId: 7,
    dateTime: new Date("2026-06-10T09:30:00Z"),
    durationMinutes: 90,
    category: "C",
    courtName: "Padel Edition",
    courtAddress: null,
    maxParticipants: 4,
    priceAed: "120.00",
    descriptionEn: null,
    descriptionRu: null,
    status: "open",
    isRecurring: false,
    recurringSeriesId: null,
    recurringPattern: null,
    createdAt: new Date("2026-06-01T00:00:00Z"),
    updatedAt: new Date("2026-06-01T00:00:00Z"),
    ...overrides,
  };
}

// Players selected for the roster: { id, name, level }. We deliberately seed
// extra phone/email fields to prove the response never echoes them back.
const rosterPlayers = [
  {
    id: 100,
    name: "Johnathan Smithfield",
    level: "C",
    phone: "+971501234567",
    email: "johnathan.smithfield@example.com",
  },
];

const bookingRows = [{ id: "aaaaaaaa-0000-0000-0000-000000000001", userId: 100 }];

beforeEach(() => {
  dbResults.length = 0;
});

describe("GET /api/group-trainings/:id/roster", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app).get(`/api/group-trainings/${TRAINING_ID}/roster`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a malformed (non-uuid) id", async () => {
    const res = await request(app)
      .get("/api/group-trainings/not-a-uuid/roster")
      .set("Authorization", `Bearer ${playerToken}`);
    expect(res.status).toBe(400);
  });

  it("returns 404 when the training does not exist", async () => {
    pushResult([]); // training lookup → none
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${coachToken}`);
    expect(res.status).toBe(404);
  });

  it("allows a coach to see the roster", async () => {
    pushResult([trainingRow()]); // training lookup
    pushResult(bookingRows); // active bookings
    pushResult(rosterPlayers); // players
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${coachToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(1);
  });

  it("allows a player with an active booking to see the roster", async () => {
    pushResult([trainingRow({ status: "completed" })]); // training (status irrelevant w/ booking)
    pushResult([{ level: "D" }]); // me (level irrelevant w/ booking)
    pushResult([{ id: "booking-1" }]); // active booking present
    pushResult(bookingRows); // roster bookings
    pushResult(rosterPlayers); // players
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("allows an eligible player to view an open training without a booking", async () => {
    pushResult([trainingRow({ status: "open", category: "C-" })]); // tIdx 3
    pushResult([{ level: "C" }]); // myIdx 4 → eligible
    pushResult([]); // no active booking
    pushResult(bookingRows); // roster bookings
    pushResult(rosterPlayers); // players
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${playerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns 403 for a player whose level is below the open training's category", async () => {
    pushResult([trainingRow({ status: "open", category: "C+" })]); // tIdx 5
    pushResult([{ level: "D" }]); // myIdx 1 → ineligible
    pushResult([]); // no active booking
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${playerToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 404 for a player with no booking on a non-open training", async () => {
    pushResult([trainingRow({ status: "completed" })]);
    pushResult([{ level: "C" }]); // eligible level, but...
    pushResult([]); // no active booking + not open/full → 404
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${playerToken}`);
    expect(res.status).toBe(404);
  });

  it("masks roster names to 'First L.' and never leaks surname, phone, or email", async () => {
    pushResult([trainingRow()]); // training
    pushResult(bookingRows); // bookings
    pushResult(rosterPlayers); // players (with phone/email seeded)
    const res = await request(app)
      .get(`/api/group-trainings/${TRAINING_ID}/roster`)
      .set("Authorization", `Bearer ${coachToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe("Johnathan S.");
    expect(res.body[0].level).toBe("C");

    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain("Smithfield");
    expect(serialized).not.toContain("+971501234567");
    expect(serialized).not.toContain("johnathan.smithfield@example.com");
  });
});
