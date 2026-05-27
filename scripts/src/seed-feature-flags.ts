/**
 * Seed `feature_flags` from the Task #151 route audit.
 * Idempotent: upserts one row per audited route using the canonical
 * schema defined in `lib/db/src/schema/feature_flags.ts`
 *   (name PK, min_tier, status; status ∈ shipped|partial|dev_only;
 *    min_tier ∈ player|coach|admin|developer).
 *
 * Public routes (login, register, landing, etc.) map to min_tier='player'
 * — the lowest authenticated tier — because the schema's check constraint
 * does not include a 'public' value. Routes truly reachable while
 * unauthenticated are flagged in the notes column.
 *
 * Run: pnpm --filter @workspace/scripts run seed-feature-flags
 */
import { Client } from "pg";

type Tier = "player" | "coach" | "admin" | "developer";
type Status = "shipped" | "partial" | "dev_only";
type Row = { name: string; status: Status; minTier: Tier; notes: string };

const ROWS: Row[] = [
  { name: "/", status: "shipped", minTier: "player", notes: "public: landing" },
  { name: "/login", status: "shipped", minTier: "player", notes: "public" },
  { name: "/register", status: "partial", minTier: "player", notes: "public: long form, placeholder hits" },
  { name: "/forgot-password", status: "shipped", minTier: "player", notes: "public" },
  { name: "/reset-password", status: "shipped", minTier: "player", notes: "public: token-driven" },
  { name: "/invite/:token", status: "shipped", minTier: "player", notes: "public: Veronika #001 verified" },
  { name: "/dashboard", status: "shipped", minTier: "player", notes: "mode-aware home" },
  { name: "/find-match", status: "shipped", minTier: "player", notes: "smart matchmaking UI" },
  { name: "/matches", status: "shipped", minTier: "player", notes: "list of matches" },
  { name: "/matches/suggest", status: "shipped", minTier: "player", notes: "suggestion flow" },
  { name: "/matches/:id", status: "shipped", minTier: "player", notes: "match detail" },
  { name: "/bookings", status: "shipped", minTier: "player", notes: "bookings list" },
  { name: "/bookings/:id", status: "partial", minTier: "player", notes: "Stripe test mode; EN/RU copy mix" },
  { name: "/courts", status: "shipped", minTier: "player", notes: "court directory" },
  { name: "/members", status: "shipped", minTier: "player", notes: "member directory" },
  { name: "/players/:id", status: "shipped", minTier: "player", notes: "public player profile" },
  { name: "/match-requests", status: "partial", minTier: "player", notes: "RU-only copy, needs polish" },
  { name: "/match-log/:id", status: "shipped", minTier: "coach", notes: "coach/admin only" },
  { name: "/match-feedback/:id", status: "shipped", minTier: "player", notes: "anonymous peer feedback" },
  { name: "/assessment", status: "shipped", minTier: "player", notes: "self-assessment intake" },
  { name: "/quiz", status: "shipped", minTier: "player", notes: "archetype quiz (RU)" },
  { name: "/level-quiz", status: "shipped", minTier: "player", notes: "public: no auth required" },
  { name: "/level-quiz/result", status: "shipped", minTier: "player", notes: "public result" },
  { name: "/level-quiz/profile", status: "shipped", minTier: "player", notes: "public profile capture" },
  { name: "/level-quiz/admin", status: "shipped", minTier: "coach", notes: "gated coach/admin" },
  { name: "/clients", status: "shipped", minTier: "coach", notes: "coach client list" },
  { name: "/clients/new", status: "shipped", minTier: "coach", notes: "new client form" },
  { name: "/clients/:id", status: "partial", minTier: "coach", notes: "duplicates /admin/clients/:userId; retire" },
  { name: "/messages", status: "shipped", minTier: "coach", notes: "WhatsApp-style hub" },
  { name: "/rules", status: "shipped", minTier: "player", notes: "padel rules EN/RU/AR" },
  { name: "/news", status: "shipped", minTier: "player", notes: "news feed" },
  { name: "/profile", status: "shipped", minTier: "player", notes: "profile editor" },
  { name: "/settings", status: "shipped", minTier: "player", notes: "account settings" },
  { name: "/video-analysis", status: "shipped", minTier: "player", notes: "video list" },
  { name: "/video-analysis/:id", status: "shipped", minTier: "player", notes: "video detail" },
  { name: "/group-trainings", status: "shipped", minTier: "player", notes: "player browse + book" },
  { name: "/coach/group-trainings", status: "shipped", minTier: "coach", notes: "coach session manager" },
  { name: "/coach", status: "shipped", minTier: "coach", notes: "coach command center" },
  { name: "/registrations", status: "shipped", minTier: "admin", notes: "signup queue" },
  { name: "/admin", status: "shipped", minTier: "admin", notes: "admin dashboard" },
  { name: "/admin/users", status: "shipped", minTier: "admin", notes: "user management" },
  { name: "/admin/clients/:userId", status: "shipped", minTier: "coach", notes: "unified client profile" },
  { name: "/admin/coaching", status: "shipped", minTier: "admin", notes: "redirect to /admin/users" },
  { name: "*", status: "shipped", minTier: "player", notes: "public: 404 not-found" },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS feature_flags (
        name text PRIMARY KEY,
        min_tier text NOT NULL,
        status text NOT NULL,
        CONSTRAINT feature_flags_min_tier_check
          CHECK (min_tier IN ('player', 'coach', 'admin', 'developer')),
        CONSTRAINT feature_flags_status_check
          CHECK (status IN ('shipped', 'partial', 'dev_only'))
      );
    `);
    for (const r of ROWS) {
      await client.query(
        `INSERT INTO feature_flags (name, min_tier, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE
         SET min_tier = EXCLUDED.min_tier,
             status = EXCLUDED.status;`,
        [r.name, r.minTier, r.status],
      );
    }
    const { rows: byTier } = await client.query<{ count: string; min_tier: string }>(
      `SELECT count(*)::text, min_tier FROM feature_flags GROUP BY min_tier ORDER BY min_tier;`,
    );
    const { rows: byStatus } = await client.query<{ count: string; status: string }>(
      `SELECT count(*)::text, status FROM feature_flags GROUP BY status ORDER BY status;`,
    );
    console.log("feature_flags seeded (canonical schema lib/db/src/schema/feature_flags.ts):");
    console.log("  by min_tier:");
    for (const r of byTier) console.log(`    ${r.min_tier.padEnd(10)} ${r.count}`);
    console.log("  by status:");
    for (const r of byStatus) console.log(`    ${r.status.padEnd(10)} ${r.count}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
