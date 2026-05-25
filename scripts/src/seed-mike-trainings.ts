import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const MIKE_EMAIL_OVERRIDE = process.env.MIKE_EMAIL;
const MIKE_EMAIL_CANDIDATES = [
  "mikebelokur8@gmail.com",
  "misha.belokur@gmail.com",
  "misha.belokur8@gmail.com",
];
const COURT_NAME = "Padel 360";

type Slot = {
  seriesId: string;
  weekday: number;
  time: string;
  durationMinutes: number;
  category: string;
  priceAed: string;
  maxParticipants: number;
  descriptionEn: string;
  descriptionRu: string;
};

const SLOTS: Slot[] = [
  {
    seriesId: "1d1d1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 2,
    time: "19:00",
    durationMinutes: 90,
    category: "D+",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D+ group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D+ — Padel 360",
  },
  {
    seriesId: "2d2d2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 2,
    time: "20:30",
    durationMinutes: 90,
    category: "D",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D — Padel 360",
  },
  {
    seriesId: "3d3d3333-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 4,
    time: "10:00",
    durationMinutes: 120,
    category: "D",
    priceAed: "200.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D extended training — Padel 360",
    descriptionRu: "Удлинённая тренировка D — Padel 360",
  },
  {
    seriesId: "4d4d4444-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 4,
    time: "12:00",
    durationMinutes: 90,
    category: "D-",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D- group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D- — Padel 360",
  },
];

function nextOccurrenceDubaiUtc(weekday: number, time: string): Date {
  const [hh, mm] = time.split(":").map((s) => parseInt(s, 10));
  const nowUtcMs = Date.now();
  const dubaiOffsetMs = 4 * 60 * 60 * 1000;
  const nowDubai = new Date(nowUtcMs + dubaiOffsetMs);
  const todayWeekday = nowDubai.getUTCDay();
  let daysAhead = (weekday - todayWeekday + 7) % 7;
  const sameDayUtc = Date.UTC(
    nowDubai.getUTCFullYear(),
    nowDubai.getUTCMonth(),
    nowDubai.getUTCDate(),
    hh - 4,
    mm,
    0,
    0,
  );
  if (daysAhead === 0 && sameDayUtc <= nowUtcMs) daysAhead = 7;
  const targetUtc = sameDayUtc + daysAhead * 24 * 60 * 60 * 1000;
  return new Date(targetUtc);
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const candidates = MIKE_EMAIL_OVERRIDE
      ? [MIKE_EMAIL_OVERRIDE]
      : MIKE_EMAIL_CANDIDATES;
    // Prefer a coach/admin/owner row to avoid landing on a player namesake.
    const mikeRes = await client.query<{ id: number; email: string; role: string }>(
      `SELECT id, email, role FROM users WHERE email = ANY($1::text[])
       ORDER BY CASE role
         WHEN 'owner' THEN 0
         WHEN 'admin' THEN 1
         WHEN 'coach' THEN 2
         ELSE 9
       END,
       array_position($1::text[], email)
       LIMIT 1`,
      [candidates],
    );
    if (mikeRes.rows.length === 0) {
      throw new Error(
        `Mike not found. Tried emails: ${candidates.join(", ")}. ` +
          `Set MIKE_EMAIL env var to override.`,
      );
    }
    const MIKE_USER_ID = mikeRes.rows[0].id;
    console.log(
      `Resolved Mike (${mikeRes.rows[0].email}, role=${mikeRes.rows[0].role}) -> userId=${MIKE_USER_ID}`,
    );
    let inserted = 0;
    let skipped = 0;
    for (const s of SLOTS) {
      const existing = await client.query(
        `SELECT id, date_time FROM group_trainings WHERE recurring_series_id = $1 LIMIT 1`,
        [s.seriesId],
      );
      if (existing.rows.length > 0) {
        skipped++;
        console.log(
          `skip ${s.category} ${s.time}: series ${s.seriesId} already seeded (id=${existing.rows[0].id})`,
        );
        continue;
      }
      const dateTime = nextOccurrenceDubaiUtc(s.weekday, s.time);
      const pattern = JSON.stringify({
        freq: "WEEKLY",
        weekday: s.weekday,
        time: s.time,
        tz: "Asia/Dubai",
      });
      const result = await client.query(
        `INSERT INTO group_trainings
          (coach_id, date_time, duration_minutes, category, court_name,
           max_participants, price_aed, description_en, description_ru,
           status, is_recurring, recurring_series_id, recurring_pattern)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',true,$10,$11)
         RETURNING id`,
        [
          MIKE_USER_ID,
          dateTime.toISOString(),
          s.durationMinutes,
          s.category,
          COURT_NAME,
          s.maxParticipants,
          s.priceAed,
          s.descriptionEn,
          s.descriptionRu,
          s.seriesId,
          pattern,
        ],
      );
      inserted++;
      console.log(
        `insert ${s.category} ${s.time}: ${dateTime.toISOString()} (id=${result.rows[0].id})`,
      );
    }
    console.log(`done. inserted=${inserted} skipped=${skipped}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
