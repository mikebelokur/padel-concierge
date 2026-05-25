/**
 * Deterministic backfill of user_type for named accounts.
 *
 * Explicit mapping per task #115:
 *   seed_test   — Anna K, Marina S, Sergey V, Dmitry P, Olga R, Alex M, Karim H, Yulia T, Veron K
 *   beta_tester — Vlad (email-first lookup; falls back to name ILIKE if email unknown)
 *   real_user   — everyone else (default; also re-set explicitly for known real accounts)
 *
 * Safe to re-run idempotently.
 * Run:  pnpm --filter @workspace/scripts run backfill-user-types
 */

import pg from "pg";

const { Pool } = pg;

const SEED_TEST_EMAILS = [
  "anna.k@test.com",
  "marina.s@test.com",
  "sergey.v@test.com",
  "dmitry.p@test.com",
  "olga.r@test.com",
  "alex.m@test.com",
  "karim.h@test.com",
  "yulia.t@test.com",
  "veron.k@test.com",
];

// Vlad's exact email once known — add here and remove name fallback
const VLAD_EMAIL: string | null = null;

const REAL_USER_EMAILS = [
  "misha.belokur@gmail.com",
  "mikebelokur8@gmail.com",
  "oleg.ilin@email.com",
  "admin@padelconcierge.com",
  "coach@padelconcierge.com",
  "player@padelconcierge.com",
  "macho21bee@gmail.com",
];

async function upsertByEmail(pool: pg.Pool, email: string, type: string): Promise<boolean> {
  const r = await pool.query(
    `UPDATE users SET user_type = $1 WHERE email = $2 RETURNING id, name`,
    [type, email]
  );
  if (r.rowCount && r.rowCount > 0) {
    console.log(`  [${type}] ✓ ${r.rows[0].name} <${email}>`);
    return true;
  }
  console.log(`  [${type}] ? NOT FOUND by email: ${email}`);
  return false;
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("=== Backfill user_type ===\n");

    // 1. real_user — explicitly named real accounts
    console.log("→ real_user");
    for (const email of REAL_USER_EMAILS) await upsertByEmail(pool, email, "real_user");

    // 2. seed_test — explicit list by email
    console.log("\n→ seed_test");
    for (const email of SEED_TEST_EMAILS) await upsertByEmail(pool, email, "seed_test");

    // 3. beta_tester — Vlad: email-first, then name fallback
    console.log("\n→ beta_tester");
    let vladDone = false;
    if (VLAD_EMAIL) {
      vladDone = await upsertByEmail(pool, VLAD_EMAIL, "beta_tester");
    }
    if (!vladDone) {
      // Name-based fallback for Vlad until email is confirmed
      const r = await pool.query(
        `UPDATE users SET user_type = 'beta_tester' WHERE name ILIKE '%vlad%' RETURNING id, name, email`
      );
      if (r.rowCount && r.rowCount > 0) {
        for (const row of r.rows) {
          console.log(`  [beta_tester] ✓ (by name) ${row.name} <${row.email}>`);
        }
      } else {
        console.log("  [beta_tester] Vlad not yet in DB — will be set on account creation");
      }
    }

    // 4. Catch-all: any remaining @test.com accounts not already in seed list → seed_test
    const catchAll = await pool.query(
      `UPDATE users SET user_type = 'seed_test'
       WHERE email LIKE '%@test.com'
         AND email NOT IN (${SEED_TEST_EMAILS.map((_, i) => `$${i + 1}`).join(",")})
       RETURNING id, name, email`,
      SEED_TEST_EMAILS
    );
    if (catchAll.rowCount && catchAll.rowCount > 0) {
      console.log(`\n→ seed_test (catch-all @test.com): ${catchAll.rowCount} extra`);
      for (const row of catchAll.rows) console.log(`  ${row.name} <${row.email}>`);
    }

    // Summary
    const counts = await pool.query(
      `SELECT user_type, count(*)::int AS n FROM users GROUP BY user_type ORDER BY user_type`
    );
    console.log("\n=== Final counts ===");
    for (const row of counts.rows) console.log(`  ${row.user_type}: ${row.n}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
