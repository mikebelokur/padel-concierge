/**
 * Deterministic backfill of user_type per task #115 named-account mapping.
 *
 * Exact assignment:
 *   real_user   — Tamara, Lena, Daniel, Александр, Mike
 *   seed_test   — Anna K, Marina S, Olga R, Sergey, Dmitry, Alex, Karim, Yulia
 *   beta_tester — Vlad
 *
 * Lookup is email-first (if email is known), otherwise name ILIKE.
 * Accounts not in any list stay at the DB default ('real_user').
 *
 * Safe to re-run idempotently.
 * Run:  pnpm --filter @workspace/scripts run backfill-user-types
 */

import pg from "pg";

const { Pool } = pg;

interface Account {
  nameLike: string;        // ILIKE pattern for name-based fallback
  email?: string;          // preferred exact email lookup
}

const REAL_USER_ACCOUNTS: Account[] = [
  { nameLike: "%tamara%"      },
  { nameLike: "%lena%"        },
  { nameLike: "%daniel%",      email: "macho21bee@gmail.com" },
  { nameLike: "%александр%"   },
  { nameLike: "%mike%",        email: "mikebelokur8@gmail.com" },
];

const SEED_TEST_ACCOUNTS: Account[] = [
  { nameLike: "%anna k%",    email: "anna.k@test.com"    },
  { nameLike: "%marina s%",  email: "marina.s@test.com"  },
  { nameLike: "%olga r%",    email: "olga.r@test.com"    },
  { nameLike: "%sergey%",    email: "sergey.v@test.com"  },
  { nameLike: "%dmitry%",    email: "dmitry.p@test.com"  },
  { nameLike: "%alex m%",    email: "alex.m@test.com"    },
  { nameLike: "%karim%",     email: "karim.h@test.com"   },
  { nameLike: "%yulia%",     email: "yulia.t@test.com"   },
];

const BETA_TESTER_ACCOUNTS: Account[] = [
  { nameLike: "%vlad%" },  // email unknown until account is created
];

async function backfillAccount(pool: pg.Pool, account: Account, type: string): Promise<void> {
  let result: pg.QueryResult | null = null;

  if (account.email) {
    result = await pool.query(
      `UPDATE users SET user_type = $1 WHERE email = $2 RETURNING id, name, email`,
      [type, account.email]
    );
    if (result.rowCount && result.rowCount > 0) {
      console.log(`  [${type}] ✓ email  ${result.rows[0].name} <${account.email}>`);
      return;
    }
  }

  // Fallback: name ILIKE
  result = await pool.query(
    `UPDATE users SET user_type = $1 WHERE name ILIKE $2 RETURNING id, name, email`,
    [type, account.nameLike]
  );
  if (result.rowCount && result.rowCount > 0) {
    for (const row of result.rows) {
      console.log(`  [${type}] ✓ name   ${row.name} <${row.email}>`);
    }
  } else {
    console.log(`  [${type}] ? NOT FOUND  pattern="${account.nameLike}"${account.email ? ` email="${account.email}"` : ""}`);
  }
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("=== Backfill user_type (task #115 named accounts) ===\n");

    console.log("→ real_user");
    for (const a of REAL_USER_ACCOUNTS) await backfillAccount(pool, a, "real_user");

    console.log("\n→ seed_test");
    for (const a of SEED_TEST_ACCOUNTS) await backfillAccount(pool, a, "seed_test");

    console.log("\n→ beta_tester");
    for (const a of BETA_TESTER_ACCOUNTS) await backfillAccount(pool, a, "beta_tester");

    // Verification summary
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
