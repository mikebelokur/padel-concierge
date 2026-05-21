import bcrypt from "bcryptjs";
import pg from "pg";

const { Pool } = pg;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function generateSlots(count: number): string {
  const slots: { start: string; end: string }[] = [];
  const now = new Date();
  const days = [1, 2, 3, 4, 5, 6, 7];
  const shuffled = days.sort(() => Math.random() - 0.5).slice(0, count);
  shuffled.sort((a, b) => a - b);
  for (const day of shuffled) {
    const start = new Date(now);
    start.setDate(now.getDate() + day);
    start.setHours(10, 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 90);
    slots.push({ start: start.toISOString(), end: end.toISOString() });
  }
  return JSON.stringify(slots);
}

const users = [
  { name: "Anna K.",    email: "anna.k@test.com",    levelSelf: 2.0, levelQuiz: "D",  archetype: "patient defender",  warmupFormat: "rotation",   physicalSelf: 5, goal: "Improve", intensity: "Casual",      level: "D"  },
  { name: "Marina S.",  email: "marina.s@test.com",  levelSelf: 2.5, levelQuiz: "D+", archetype: "patient defender",  warmupFormat: "rotation",   physicalSelf: 6, goal: "Play",    intensity: "Casual",      level: "D+" },
  { name: "Sergey V.",  email: "sergey.v@test.com",  levelSelf: 3.0, levelQuiz: "C-", archetype: "smart attacker",    warmupFormat: "classic",    physicalSelf: 7, goal: "Compete", intensity: "Active",      level: "C-" },
  { name: "Dmitry P.",  email: "dmitry.p@test.com",  levelSelf: 3.5, levelQuiz: "C",  archetype: "smart attacker",    warmupFormat: "classic",    physicalSelf: 8, goal: "Compete", intensity: "Competitive", level: "C"  },
  { name: "Olga R.",    email: "olga.r@test.com",    levelSelf: 2.0, levelQuiz: "D-", archetype: "social player",     warmupFormat: "simplified", physicalSelf: 4, goal: "Fitness", intensity: "Casual",      level: "D-" },
  { name: "Alex M.",    email: "alex.m@test.com",    levelSelf: 3.0, levelQuiz: "C-", archetype: "social player",     warmupFormat: "simplified", physicalSelf: 6, goal: "Play",    intensity: "Active",      level: "C-" },
  { name: "Karim H.",   email: "karim.h@test.com",   levelSelf: 4.0, levelQuiz: "C+", archetype: "tactical thinker",  warmupFormat: "classic",    physicalSelf: 9, goal: "Compete", intensity: "Competitive", level: "C+" },
  { name: "Yulia T.",   email: "yulia.t@test.com",   levelSelf: 2.5, levelQuiz: "D+", archetype: "tactical thinker",  warmupFormat: "rotation",   physicalSelf: 7, goal: "Improve", intensity: "Active",      level: "D+" },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const passwordHash = await hashPassword("test1234");

  let inserted = 0;
  for (const u of users) {
    const slotCount = 3 + Math.floor(Math.random() * 3); // 3–5
    const availability = generateSlots(slotCount);

    const result = await pool.query(
      `INSERT INTO users
        (name, email, phone, password_hash, level, goal, intensity,
         location_lat, location_lng, location_name,
         verified, approval_status, role,
         archetype, level_self, level_quiz, physical_self, warmup_format,
         availability)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [
        u.name, u.email, "+971500000000", passwordHash,
        u.level, u.goal, u.intensity,
        25.2048, 55.2708, "Dubai",
        true, "active", "player",
        u.archetype, u.levelSelf, u.levelQuiz, u.physicalSelf, u.warmupFormat,
        availability,
      ]
    );
    if (result.rowCount && result.rowCount > 0) inserted++;
  }

  console.log(`Inserted ${inserted} new users (skipped ${users.length - inserted} duplicates).`);

  const check = await pool.query(
    `SELECT name, level_self, level_quiz, archetype, physical_self
     FROM users ORDER BY created_at DESC LIMIT 10`
  );
  console.table(check.rows);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
