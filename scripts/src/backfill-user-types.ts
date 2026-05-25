/**
 * Deterministic backfill of user_type for named accounts.
 *
 * Explicit mapping (by email):
 *   real_user  — Misha, Mike, Oleg Ilin, vero, admin/coach/player test accounts, Daniel
 *   seed_test  — Anna K, Marina S, Sergey V, Dmitry P, Olga R, Alex M, Karim H, Yulia T, Veron K
 *   beta_tester — Vlad (not yet in DB — will log "NOT FOUND" and skip gracefully)
 *
 * Safe to re-run at any time — idempotent.
 *
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

const BETA_TESTER_EMAILS = [
  // Vlad — email to be filled once account is created
  // "vlad@example.com",
];

const REAL_USER_EMAILS = [
  "misha.belokur@gmail.com",
  "mikebelokur8@gmail.com",
  "oleg.ilin@email.com",
  "admin@padelconcierge.com",
  "coach@padelconcierge.com",
  "player@padelconcierge.com",
  "macho21bee@gmail.com",
];

async function setType(pool: pg.Pool, emails: string[], type: string) {
  let updated = 0;
  const notFound: string[] = [];
  for (const email of emails) {
    const r = await pool.query(
      `UPDATE users SET user_type = $1 WHERE email = $2 RETURNING id, name`,
      [type, email]
    );
    if (r.rowCount && r.rowCount > 0) {
      updated++;
      console.log(`  [${type}] ✓ ${r.rows[0].name} <${email}>`);
    } else {
      notFound.push(email);
      console.log(`  [${type}] ? NOT FOUND: ${email}`);
    }
  }
  return { updated, notFound };
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("=== Backfill user_type ===\n");

    console.log("→ real_user");
    await setType(pool, REAL_USER_EMAILS, "real_user");

    // Also catch any remaining @test.com accounts not in the explicit list
    const catchAll = await pool.query(
      `UPDATE users SET user_type = 'seed_test' WHERE email LIKE '%@test.com' AND email NOT IN (${SEED_TEST_EMAILS.map((_, i) => `$${i + 1}`).join(",")}) RETURNING id, name, email`,
      SEED_TEST_EMAILS
    );
    if (catchAll.rowCount && catchAll.rowCount > 0) {
      console.log(`\n  [seed_test - catch-all @test.com] ${catchAll.rowCount} extra rows:`);
      for (const row of catchAll.rows) console.log(`    ${row.name} <${row.email}>`);
    }

    console.log("\n→ seed_test");
    await setType(pool, SEED_TEST_EMAILS, "seed_test");

    console.log("\n→ beta_tester");
    if (BETA_TESTER_EMAILS.length > 0) {
      await setType(pool, BETA_TESTER_EMAILS, "beta_tester");
    } else {
      console.log("  (no beta tester emails configured — Vlad's email to be added once account exists)");
    }

    // Summary
    const counts = await pool.query(
      `SELECT user_type, count(*)::int AS n FROM users GROUP BY user_type ORDER BY user_type`
    );
    console.log("\n=== Final counts ===");
    for (const row of counts.rows) {
      console.log(`  ${row.user_type}: ${row.n}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
