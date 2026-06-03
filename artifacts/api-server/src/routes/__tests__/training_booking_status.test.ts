/**
 * Coverage for the coach-only booking status update endpoint:
 *   PATCH /api/group-trainings/:id/bookings/:bookingId
 *
 * Rules under test (see group_trainings.ts updateTrainingBookingStatus handler):
 *   - players (non-coach) are forbidden (403)
 *   - malformed training/booking uuid → 400
 *   - invalid status value → 400
 *   - missing training → 404, missing booking → 404
 *   - a coach who does not own the training → 403
 *   - a cancelled booking cannot be updated → 400
 *   - a coach can mark a booking attended / no_show and the row reflects it
 *
 * Mirrors the db-mocking approach of training_roster.test.ts — deterministic,
 * no live Postgres needed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

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

const { default: app } = await import("../../app");
const { generateToken } = await import("../../lib/auth");
const request = (await import("supertest")).default;

const TRAINING_ID = "11111111-1111-4111-8111-111111111111";
const BOOKING_ID = "22222222-2222-4222-8222-222222222222";

const coachToken = generateToken(7, "coach");
const otherCoachToken = generateToken(8, "coach");
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

function bookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    trainingId: TRAINING_ID,
    userId: 100,
    status: "booked",
    bookedAt: new Date("2026-06-05T00:00:00Z"),
    cancelledAt: null,
    createdAt: new Date("2026-06-05T00:00:00Z"),
    ...overrides,
  };
}

const playerRow = {
  id: 100,
  name: "Johnathan Smithfield",
  email: "johnathan.smithfield@example.com",
  phone: "+971501234567",
  level: "C",
  avatar: null,
};

beforeEach(() => {
  dbResults.length = 0;
});

describe("PATCH /api/group-trainings/:id/bookings/:bookingId", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .send({ status: "attended" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-coach player", async () => {
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${playerToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(403);
  });

  it("returns 400 for a malformed booking uuid", async () => {
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/not-a-uuid`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "cancelled" });
    expect(res.status).toBe(400);
  });

  it("returns 404 when the training does not exist", async () => {
    pushResult([]); // training lookup → none
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the coach does not own the training", async () => {
    pushResult([trainingRow()]); // training owned by coach 7
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${otherCoachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the booking does not exist", async () => {
    pushResult([trainingRow()]); // training
    pushResult([]); // booking lookup → none
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(404);
  });

  it("returns 400 when updating a cancelled booking", async () => {
    pushResult([trainingRow()]); // training
    pushResult([bookingRow({ status: "cancelled" })]); // booking is cancelled
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(400);
  });

  it("lets a coach mark a booking attended", async () => {
    pushResult([trainingRow()]); // training
    pushResult([bookingRow()]); // existing booking
    pushResult([bookingRow({ status: "attended" })]); // update returning
    pushResult([playerRow]); // player lookup
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "attended" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("attended");
    expect(res.body.player.id).toBe(100);
  });

  it("lets a coach mark a booking no_show", async () => {
    pushResult([trainingRow()]); // training
    pushResult([bookingRow()]); // existing booking
    pushResult([bookingRow({ status: "no_show" })]); // update returning
    pushResult([playerRow]); // player lookup
    const res = await request(app)
      .patch(`/api/group-trainings/${TRAINING_ID}/bookings/${BOOKING_ID}`)
      .set("Authorization", `Bearer ${coachToken}`)
      .send({ status: "no_show" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("no_show");
  });
});
