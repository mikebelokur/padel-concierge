import { Client } from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// Optional override to pin the owning coach to a specific email.
const COACH_EMAIL_OVERRIDE = process.env.MIKE_EMAIL ?? process.env.COACH_EMAIL;
const COACH_EMAIL_CANDIDATES = [
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

// Two Tuesday + two Thursday weekly slots, levels D and D- only.
// Each capped at 4 participants.
const SLOTS: Slot[] = [
  {
    seriesId: "1d1d1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 2,
    time: "19:00",
    durationMinutes: 90,
    category: "D",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D — Padel 360",
  },
  {
    seriesId: "2d2d2222-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 2,
    time: "20:30",
    durationMinutes: 90,
    category: "D-",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D- group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D- — Padel 360",
  },
  {
    seriesId: "3d3d3333-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    weekday: 4,
    time: "10:00",
    durationMinutes: 90,
    category: "D",
    priceAed: "175.00",
    maxParticipants: 4,
    descriptionEn: "Weekly D group training — Padel 360",
    descriptionRu: "Еженедельная тренировка D — Padel 360",
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

type CoachRow = { id: number; email: string; role: string };

/**
 * Resolve the owning coach. Prefers an explicit email match (real users only,
 * highest role first), and falls back to any real admin/coach/owner account so
 * the seed never fails just because the hard-coded emails are absent.
 */
async function resolveCoach(client: Client): Promise<CoachRow> {
  const candidates = COACH_EMAIL_OVERRIDE
    ? [COACH_EMAIL_OVERRIDE]
    : COACH_EMAIL_CANDIDATES;

  const byEmail = await client.query<CoachRow>(
    `SELECT id, email, role FROM users
     WHERE email = ANY($1::text[])
       AND user_type = 'real_user'
       AND role IN ('owner', 'admin', 'coach')
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
  if (byEmail.rows.length > 0) return byEmail.rows[0];

  const byRole = await client.query<CoachRow>(
    `SELECT id, email, role FROM users
     WHERE user_type = 'real_user'
       AND role IN ('owner', 'admin', 'coach')
     ORDER BY CASE role
       WHEN 'owner' THEN 0
       WHEN 'admin' THEN 1
       WHEN 'coach' THEN 2
       ELSE 9
     END,
     id
     LIMIT 1`,
  );
  if (byRole.rows.length > 0) return byRole.rows[0];

  throw new Error(
    "No real admin/coach/owner account found to own the trainings. " +
      "Create one or set COACH_EMAIL to override.",
  );
}

async function main() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    const coach = await resolveCoach(client);
    console.log(
      `Resolved coach (${coach.email}, role=${coach.role}) -> userId=${coach.id}`,
    );

    let inserted = 0;
    let updated = 0;
    for (const s of SLOTS) {
      const pattern = JSON.stringify({
        freq: "WEEKLY",
        weekday: s.weekday,
        time: s.time,
        tz: "Asia/Dubai",
      });

      const existing = await client.query<{ id: string; date_time: Date }>(
        `SELECT id, date_time FROM group_trainings
         WHERE recurring_series_id = $1 LIMIT 1`,
        [s.seriesId],
      );

      if (existing.rows.length > 0) {
        // Correct any drift (e.g. previously seeded with a different level /
        // coach) without disturbing future-dated rows or their bookings.
        // If the stored occurrence is already in the past, roll it forward to
        // the next upcoming slot and reopen it so it shows up in the app.
        const id = existing.rows[0].id;
        const isPast = new Date(existing.rows[0].date_time).getTime() <= Date.now();
        const nextDateTime = nextOccurrenceDubaiUtc(s.weekday, s.time);
        await client.query(
          `UPDATE group_trainings SET
             coach_id = $1,
             duration_minutes = $2,
             category = $3,
             court_name = $4,
             max_participants = $5,
             price_aed = $6,
             description_en = $7,
             description_ru = $8,
             is_recurring = true,
             recurring_pattern = $9,
             date_time = CASE WHEN $11::boolean THEN $12 ELSE date_time END,
             status = CASE WHEN $11::boolean THEN 'open' ELSE status END,
             updated_at = now()
           WHERE id = $10`,
          [
            coach.id,
            s.durationMinutes,
            s.category,
            COURT_NAME,
            s.maxParticipants,
            s.priceAed,
            s.descriptionEn,
            s.descriptionRu,
            pattern,
            id,
            isPast,
            nextDateTime.toISOString(),
          ],
        );
        updated++;
        console.log(
          `update ${s.category} ${s.time}: series ${s.seriesId} (id=${id})` +
            (isPast ? ` -> rolled forward to ${nextDateTime.toISOString()}` : ""),
        );
        continue;
      }

      const dateTime = nextOccurrenceDubaiUtc(s.weekday, s.time);
      const result = await client.query<{ id: string }>(
        `INSERT INTO group_trainings
          (coach_id, date_time, duration_minutes, category, court_name,
           max_participants, price_aed, description_en, description_ru,
           status, is_recurring, recurring_series_id, recurring_pattern)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'open',true,$10,$11)
         RETURNING id`,
        [
          coach.id,
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
    console.log(`done. inserted=${inserted} updated=${updated}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
