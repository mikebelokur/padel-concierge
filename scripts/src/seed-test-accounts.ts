import crypto from "crypto";
import pg from "pg";

const { Pool } = pg;

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "padel-salt").digest("hex");
}

const TEST_ACCOUNTS = [
  {
    name: "Admin User",
    email: "admin@padelconcierge.com",
    password: "admin123",
    role: "admin",
    level: "C",
  },
  {
    name: "Coach User",
    email: "coach@padelconcierge.com",
    password: "coach123",
    role: "coach",
    level: "C+",
  },
  {
    name: "Player User",
    email: "player@padelconcierge.com",
    password: "player123",
    role: "player",
    level: "D",
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let inserted = 0;
  let updated = 0;

  for (const account of TEST_ACCOUNTS) {
    const passwordHash = hashPassword(account.password);

    const existing = await pool.query(
      `SELECT id FROM users WHERE email = $1`,
      [account.email]
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query(
        `UPDATE users SET name = $1, password_hash = $2, role = $3, level = $4,
         approval_status = 'approved', verified = true
         WHERE email = $5`,
        [account.name, passwordHash, account.role, account.level, account.email]
      );
      updated++;
      console.log(`Updated: ${account.email} (${account.role})`);
    } else {
      await pool.query(
        `INSERT INTO users
          (name, email, phone, password_hash, role, level, goal, intensity,
           verified, approval_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          account.name,
          account.email,
          "+971500000000",
          passwordHash,
          account.role,
          account.level,
          "Play",
          "Active-Dynamic",
          true,
          "approved",
        ]
      );
      inserted++;
      console.log(`Created: ${account.email} (${account.role})`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}`);

  const check = await pool.query(
    `SELECT id, name, email, role, level, verified, approval_status
     FROM users
     WHERE email = ANY($1)
     ORDER BY role`,
    [TEST_ACCOUNTS.map((a) => a.email)]
  );
  console.table(check.rows);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
