import { test, expect, request as pwRequest } from "@playwright/test";
import { Client } from "pg";

const PLAYER_EMAIL = "player@padelconcierge.com";
const PLAYER_PASSWORD = "player123";
const ADMIN_EMAIL = "admin@padelconcierge.com";
const ADMIN_PASSWORD = "admin123";

async function pg() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set for e2e test");
  const client = new Client({ connectionString: url });
  await client.connect();
  return client;
}

async function setStatus(trainingId: string, status: "scheduled" | "open" | "closed") {
  const db = await pg();
  try {
    await db.query("UPDATE group_trainings SET status = $1, updated_at = now() WHERE id = $2", [status, trainingId]);
  } finally {
    await db.end();
  }
}

async function clearBookings(trainingId: string) {
  const db = await pg();
  try {
    await db.query("DELETE FROM training_bookings WHERE training_id = $1", [trainingId]);
  } finally {
    await db.end();
  }
}

test.describe("Registration window enforcement (scheduled / open / closed)", () => {
  let trainingId: string;
  let playerToken: string;

  test.beforeAll(async ({ baseURL }) => {
    const apiCtx = await pwRequest.newContext({ baseURL });

    const adminLogin = await apiCtx.post("/api/auth/login", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
    });
    expect(adminLogin.status()).toBe(200);
    const { token: adminToken } = (await adminLogin.json()) as { token: string };

    const playerLogin = await apiCtx.post("/api/auth/login", {
      data: { email: PLAYER_EMAIL, password: PLAYER_PASSWORD },
    });
    expect(playerLogin.status()).toBe(200);
    playerToken = ((await playerLogin.json()) as { token: string }).token;

    // Find a coach to own the test training.
    const usersRes = await apiCtx.get("/api/admin/users", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(usersRes.status()).toBe(200);
    const users = (await usersRes.json()) as Array<{ id: number; role: string }>;
    const coach = users.find((u) => u.role === "coach" || u.role === "owner");
    if (!coach) throw new Error("No coach user available to anchor test training");

    // Seed a training 48h out so it does not collide with the auto-open scheduler (which opens 36h ahead).
    const db = await pg();
    try {
      const result = await db.query(
        `INSERT INTO group_trainings (
           coach_id, date_time, duration_minutes, category, court_name, court_address,
           max_participants, price_aed, description_en, description_ru, status, is_recurring
         ) VALUES ($1, now() + interval '48 hours', 90, 'D+', 'E2E Test Court', 'E2E Test Address',
                   4, 100.00, 'E2E window test', 'E2E тест окна', 'scheduled', false)
         RETURNING id`,
        [coach.id],
      );
      trainingId = result.rows[0].id;
    } finally {
      await db.end();
    }

    await apiCtx.dispose();
  });

  test.afterAll(async () => {
    if (!trainingId) return;
    const db = await pg();
    try {
      await db.query("DELETE FROM training_bookings WHERE training_id = $1", [trainingId]);
      await db.query("DELETE FROM group_trainings WHERE id = $1", [trainingId]);
    } finally {
      await db.end();
    }
  });

  test("status=scheduled → booking rejected with reason=scheduled (409)", async ({ baseURL }) => {
    await setStatus(trainingId, "scheduled");
    await clearBookings(trainingId);

    const api = await pwRequest.newContext({ baseURL });
    const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status()).toBe(409);
    const body = (await res.json()) as { reason?: string };
    expect(body.reason).toBe("scheduled");
    await api.dispose();
  });

  test("status=open → booking succeeds (201)", async ({ baseURL }) => {
    await setStatus(trainingId, "open");
    await clearBookings(trainingId);

    const api = await pwRequest.newContext({ baseURL });
    const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status(), `expected 201 on open, got ${res.status()}: ${await res.text()}`).toBe(201);
    const body = (await res.json()) as { trainingId: string; status: string };
    expect(body.trainingId).toBe(trainingId);
    expect(body.status).toBe("booked");
    await api.dispose();
  });

  test("status=closed → booking rejected with reason=closed (409)", async ({ baseURL }) => {
    await clearBookings(trainingId);
    await setStatus(trainingId, "closed");

    const api = await pwRequest.newContext({ baseURL });
    const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status()).toBe(409);
    const body = (await res.json()) as { reason?: string };
    expect(body.reason).toBe("closed");
    await api.dispose();
  });

  test("missing training id → 404", async ({ baseURL }) => {
    const api = await pwRequest.newContext({ baseURL });
    const res = await api.post(`/api/group-trainings/00000000-0000-4000-8000-000000000000/book`, {
      headers: { Authorization: `Bearer ${playerToken}` },
    });
    expect(res.status()).toBe(404);
    await api.dispose();
  });
});
