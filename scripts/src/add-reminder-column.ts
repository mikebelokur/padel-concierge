import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({ connectionString: DATABASE_URL });

const result = await pool.query(
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ"
);
console.log("Migration result:", result.command);
await pool.end();
console.log("Done.");
