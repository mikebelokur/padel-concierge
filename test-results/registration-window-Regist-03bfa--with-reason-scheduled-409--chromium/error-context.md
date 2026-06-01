# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: registration-window.spec.ts >> Registration window enforcement (scheduled / open / closed) >> status=scheduled → booking rejected with reason=scheduled (409)
- Location: e2e/registration-window.spec.ts:94:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 403
```

# Test source

```ts
  1   | import { test, expect, request as pwRequest } from "@playwright/test";
  2   | import { Client } from "pg";
  3   | 
  4   | const PLAYER_EMAIL = "player@padelconcierge.com";
  5   | const PLAYER_PASSWORD = "player123";
  6   | const ADMIN_EMAIL = "admin@padelconcierge.com";
  7   | const ADMIN_PASSWORD = "admin123";
  8   | 
  9   | async function pg() {
  10  |   const url = process.env.DATABASE_URL;
  11  |   if (!url) throw new Error("DATABASE_URL not set for e2e test");
  12  |   const client = new Client({ connectionString: url });
  13  |   await client.connect();
  14  |   return client;
  15  | }
  16  | 
  17  | async function setStatus(trainingId: string, status: "scheduled" | "open" | "closed") {
  18  |   const db = await pg();
  19  |   try {
  20  |     await db.query("UPDATE group_trainings SET status = $1, updated_at = now() WHERE id = $2", [status, trainingId]);
  21  |   } finally {
  22  |     await db.end();
  23  |   }
  24  | }
  25  | 
  26  | async function clearBookings(trainingId: string) {
  27  |   const db = await pg();
  28  |   try {
  29  |     await db.query("DELETE FROM training_bookings WHERE training_id = $1", [trainingId]);
  30  |   } finally {
  31  |     await db.end();
  32  |   }
  33  | }
  34  | 
  35  | test.describe("Registration window enforcement (scheduled / open / closed)", () => {
  36  |   let trainingId: string;
  37  |   let playerToken: string;
  38  | 
  39  |   test.beforeAll(async ({ baseURL }) => {
  40  |     const apiCtx = await pwRequest.newContext({ baseURL });
  41  | 
  42  |     const adminLogin = await apiCtx.post("/api/auth/login", {
  43  |       data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  44  |     });
  45  |     expect(adminLogin.status()).toBe(200);
  46  |     const { token: adminToken } = (await adminLogin.json()) as { token: string };
  47  | 
  48  |     const playerLogin = await apiCtx.post("/api/auth/login", {
  49  |       data: { email: PLAYER_EMAIL, password: PLAYER_PASSWORD },
  50  |     });
  51  |     expect(playerLogin.status()).toBe(200);
  52  |     playerToken = ((await playerLogin.json()) as { token: string }).token;
  53  | 
  54  |     // Find a coach to own the test training.
  55  |     const usersRes = await apiCtx.get("/api/admin/users", {
  56  |       headers: { Authorization: `Bearer ${adminToken}` },
  57  |     });
> 58  |     expect(usersRes.status()).toBe(200);
      |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  59  |     const users = (await usersRes.json()) as Array<{ id: number; role: string }>;
  60  |     const coach = users.find((u) => u.role === "coach" || u.role === "owner");
  61  |     if (!coach) throw new Error("No coach user available to anchor test training");
  62  | 
  63  |     // Seed a training 48h out so it does not collide with the auto-open scheduler (which opens 36h ahead).
  64  |     const db = await pg();
  65  |     try {
  66  |       const result = await db.query(
  67  |         `INSERT INTO group_trainings (
  68  |            coach_id, date_time, duration_minutes, category, court_name, court_address,
  69  |            max_participants, price_aed, description_en, description_ru, status, is_recurring
  70  |          ) VALUES ($1, now() + interval '48 hours', 90, 'D+', 'E2E Test Court', 'E2E Test Address',
  71  |                    4, 100.00, 'E2E window test', 'E2E тест окна', 'scheduled', false)
  72  |          RETURNING id`,
  73  |         [coach.id],
  74  |       );
  75  |       trainingId = result.rows[0].id;
  76  |     } finally {
  77  |       await db.end();
  78  |     }
  79  | 
  80  |     await apiCtx.dispose();
  81  |   });
  82  | 
  83  |   test.afterAll(async () => {
  84  |     if (!trainingId) return;
  85  |     const db = await pg();
  86  |     try {
  87  |       await db.query("DELETE FROM training_bookings WHERE training_id = $1", [trainingId]);
  88  |       await db.query("DELETE FROM group_trainings WHERE id = $1", [trainingId]);
  89  |     } finally {
  90  |       await db.end();
  91  |     }
  92  |   });
  93  | 
  94  |   test("status=scheduled → booking rejected with reason=scheduled (409)", async ({ baseURL }) => {
  95  |     await setStatus(trainingId, "scheduled");
  96  |     await clearBookings(trainingId);
  97  | 
  98  |     const api = await pwRequest.newContext({ baseURL });
  99  |     const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
  100 |       headers: { Authorization: `Bearer ${playerToken}` },
  101 |     });
  102 |     expect(res.status()).toBe(409);
  103 |     const body = (await res.json()) as { reason?: string };
  104 |     expect(body.reason).toBe("scheduled");
  105 |     await api.dispose();
  106 |   });
  107 | 
  108 |   test("status=open → booking succeeds (201)", async ({ baseURL }) => {
  109 |     await setStatus(trainingId, "open");
  110 |     await clearBookings(trainingId);
  111 | 
  112 |     const api = await pwRequest.newContext({ baseURL });
  113 |     const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
  114 |       headers: { Authorization: `Bearer ${playerToken}` },
  115 |     });
  116 |     expect(res.status(), `expected 201 on open, got ${res.status()}: ${await res.text()}`).toBe(201);
  117 |     const body = (await res.json()) as { trainingId: string; status: string };
  118 |     expect(body.trainingId).toBe(trainingId);
  119 |     expect(body.status).toBe("booked");
  120 |     await api.dispose();
  121 |   });
  122 | 
  123 |   test("status=closed → booking rejected with reason=closed (409)", async ({ baseURL }) => {
  124 |     await clearBookings(trainingId);
  125 |     await setStatus(trainingId, "closed");
  126 | 
  127 |     const api = await pwRequest.newContext({ baseURL });
  128 |     const res = await api.post(`/api/group-trainings/${trainingId}/book`, {
  129 |       headers: { Authorization: `Bearer ${playerToken}` },
  130 |     });
  131 |     expect(res.status()).toBe(409);
  132 |     const body = (await res.json()) as { reason?: string };
  133 |     expect(body.reason).toBe("closed");
  134 |     await api.dispose();
  135 |   });
  136 | 
  137 |   test("missing training id → 404", async ({ baseURL }) => {
  138 |     const api = await pwRequest.newContext({ baseURL });
  139 |     const res = await api.post(`/api/group-trainings/00000000-0000-4000-8000-000000000000/book`, {
  140 |       headers: { Authorization: `Bearer ${playerToken}` },
  141 |     });
  142 |     expect(res.status()).toBe(404);
  143 |     await api.dispose();
  144 |   });
  145 | });
  146 | 
```