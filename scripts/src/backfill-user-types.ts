/**
 * Backfill user_type for existing accounts.
 *
 * Rules:
 *  - Accounts with @test.com emails → seed_test
 *  - Explicit beta_tester list (by email) → beta_tester
 *  - Everything else → real_user (already the column default)
 *
 * Run:  pnpm --filter @workspace/scripts run backfill-user-types
 */

import pg from "pg";

const { Pool } = pg;

const BETA_EMAILS: string[] = [
  // Add beta tester emails here as the list grows
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. seed_test: anyone with @test.com email
    const seedResult = await pool.query(
      `UPDATE users SET user_type = 'seed_test' WHERE email LIKE '%@test.com' RETURNING id, name, email`
    );
    console.log(`seed_test  → ${seedResult.rowCount} rows updated`);
    for (const row of seedResult.rows) {
      console.log(`  id=${row.id} ${row.name} <${row.email}>`);
    }

    // 2. beta_tester: explicit list
    if (BETA_EMAILS.length > 0) {
      for (const email of BETA_EMAILS) {
        const r = await pool.query(
          `UPDATE users SET user_type = 'beta_tester' WHERE email = $1 RETURNING id, name`,
          [email]
        );
        if (r.rowCount) {
          console.log(`beta_tester → ${r.rows[0].name} <${email}>`);
        } else {
          console.log(`beta_tester → NOT FOUND: ${email}`);
        }
      }
    } else {
      console.log("beta_tester → no emails configured");
    }

    // 3. Summary
    const counts = await pool.query(
      `SELECT user_type, count(*)::int AS n FROM users GROUP BY user_type ORDER BY user_type`
    );
    console.log("\nFinal counts:");
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
