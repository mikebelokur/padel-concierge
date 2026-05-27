import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireMode } from "../middleware/auth";

const requireAdminOrCoach = requireMode("coach", "admin", "developer");

const router = Router();

function levelToScore(level: string | null | undefined): number | null {
  const map: Record<string, number> = { "D-": 0, "D": 20, "D+": 40, "C-": 60, "C": 80, "C+": 100 };
  return level ? (map[level] ?? null) : null;
}

function deriveOnboardingStatus(row: { verified: boolean; approval_status: string }): "pending" | "approved" | "verified" {
  if (row.verified) return "verified";
  if (row.approval_status === "approved") return "approved";
  return "pending";
}

function escCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function findMatchesByEmail(email: string): Promise<unknown[]> {
  const mainUser = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email.toLowerCase()]
  );
  if (!mainUser.rows.length) return [];
  const uid = mainUser.rows[0].id;
  const matchRows = await pool.query(
    `SELECT id, date, time, club_name, format, status, players
     FROM matches
     WHERE players::jsonb @> jsonb_build_array($1::integer)
     ORDER BY date DESC LIMIT 20`,
    [uid]
  );
  return matchRows.rows;
}

router.post("/pf/register", async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "name and email required" });
    return;
  }
  try {
    const existing = await pool.query(
      "SELECT id FROM pf_users WHERE email = $1",
      [email.toLowerCase().trim()]
    );
    let user;
    if (existing.rows.length) {
      user = (await pool.query("SELECT * FROM pf_users WHERE id = $1", [existing.rows[0].id])).rows[0];
    } else {
      user = (await pool.query(
        "INSERT INTO pf_users (name, email, phone) VALUES ($1, $2, $3) RETURNING *",
        [name.trim(), email.toLowerCase().trim(), phone?.trim() || null]
      )).rows[0];
    }
    const quizResult = (await pool.query(
      "SELECT * FROM pf_quiz_results WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [user.id]
    )).rows[0] ?? null;
    res.json({ user, quizResult });
  } catch (err: any) {
    req.log.error({ err }, "pf register error");
    res.status(500).json({ error: "registration failed" });
  }
});

router.post("/pf/quiz", async (req, res) => {
  const {
    userEmail, quizLevel, realLevel, personalityType,
    q1Answer, q2Answer, q3Answer,
    q4Answer, q4Extra,
    q5Answer, q6Answer, q7Answer, q8Answer, q9Answer, q10Answer,
  } = req.body;

  if (!quizLevel || !realLevel) {
    res.status(400).json({ error: "quizLevel and realLevel required" });
    return;
  }

  try {
    let userId: number | null = null;
    if (userEmail) {
      const lookup = await pool.query(
        "SELECT id FROM pf_users WHERE email = $1",
        [String(userEmail).toLowerCase().trim()]
      );
      if (lookup.rows.length) userId = lookup.rows[0].id;
    }

    const sessionId = crypto.randomUUID();

    const result = await pool.query(
      `INSERT INTO pf_quiz_results
        (session_id, user_id, quiz_level, real_level, personality_type,
         q1_answer, q2_answer, q3_answer,
         q4_answer, q4_extra, q5_answer, q6_answer, q7_answer, q8_answer, q9_answer, q10_answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING *`,
      [
        sessionId, userId, quizLevel, realLevel, personalityType || null,
        q1Answer ?? null, q2Answer ?? null, q3Answer ?? null,
        q4Answer || null, q4Extra || null,
        q5Answer || null, q6Answer || null, q7Answer || null,
        q8Answer || null, q9Answer || null, q10Answer || null,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    req.log.error({ err }, "pf quiz save error");
    res.status(500).json({ error: "quiz save failed" });
  }
});

router.get("/pf/session/:sessionId", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM pf_quiz_results WHERE session_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [req.params.sessionId]
    );
    if (!result.rows.length) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(result.rows[0]);
  } catch (err: any) {
    req.log.error({ err }, "pf get session error");
    res.status(500).json({ error: "fetch failed" });
  }
});

router.get("/pf/admin", requireAdminOrCoach, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, session_id, real_level, quiz_level, personality_type,
             q1_answer, q2_answer, q3_answer, completed_at
      FROM pf_quiz_results
      ORDER BY completed_at DESC
    `);
    res.json({ results: result.rows, total: result.rows.length });
  } catch (err: any) {
    req.log.error({ err }, "pf admin error");
    res.status(500).json({ error: "fetch failed" });
  }
});

async function handleExportCsv(req: any, res: any) {
  const auth = req.auth;
  const isCoach = auth.role === "coach";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="pf-users.csv"');

  const headers = isCoach
    ? ["id", "name", "created_at", "verified", "approval_status", "location_name", "neighbourhood", "level_self", "quiz_level", "real_level", "personality_type", "quiz_completed_at", "q1_answer", "q2_answer", "q3_answer", "q4_answer", "q4_extra", "q5_answer", "q6_answer", "q7_answer", "q8_answer", "q9_answer", "q10_answer"]
    : ["id", "name", "email", "phone", "created_at", "verified", "approval_status", "location_name", "neighbourhood", "level_self", "quiz_level", "real_level", "personality_type", "quiz_completed_at", "q1_answer", "q2_answer", "q3_answer", "q4_answer", "q4_extra", "q5_answer", "q6_answer", "q7_answer", "q8_answer", "q9_answer", "q10_answer"];

  res.write(headers.join(",") + "\n");

  const PAGE_SIZE = 100;
  let offset = 0;
  try {
    while (true) {
      const { rows } = await pool.query(`
        SELECT
          u.id, u.name, ${isCoach ? "" : "u.email, u.phone,"} u.created_at,
          u.verified, u.approval_status, u.location_name, u.neighbourhood,
          qr.quiz_level, qr.real_level, qr.personality_type,
          qr.completed_at AS quiz_completed_at,
          qr.q1_answer, qr.q2_answer, qr.q3_answer,
          qr.q4_answer, qr.q4_extra,
          qr.q5_answer, qr.q6_answer, qr.q7_answer,
          qr.q8_answer, qr.q9_answer, qr.q10_answer
        FROM pf_users u
        LEFT JOIN pf_quiz_results qr ON qr.user_id = u.id
          AND qr.id = (SELECT MAX(id) FROM pf_quiz_results WHERE user_id = u.id)
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `, [PAGE_SIZE, offset]);

      if (!rows.length) break;

      for (const row of rows) {
        const levelSelf = levelToScore(row.real_level ?? null);
        const enriched = { ...row, level_self: levelSelf };
        const vals = headers.map((h) => escCsv(enriched[h]));
        res.write(vals.join(",") + "\n");
      }

      offset += PAGE_SIZE;
      if (rows.length < PAGE_SIZE) break;
    }
  } catch (err: any) {
    req.log.error({ err }, "pf admin csv export error");
  }
  res.end();
}

async function handleUsersList(req: any, res: any) {
  const auth = req.auth;
  const isCoach = auth.role === "coach";

  const search = (req.query.search as string || "").trim();
  const status = req.query.status as string || "";
  const page = Math.max(1, parseInt(req.query.page as string || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${i} OR u.email ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }

    if (status === "pending") {
      conditions.push("u.verified = false AND u.approval_status = 'pending'");
    } else if (status === "approved") {
      conditions.push("u.verified = false AND u.approval_status = 'approved'");
    } else if (status === "verified") {
      conditions.push("u.verified = true");
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const totalResult = await pool.query(`
      SELECT COUNT(*) FROM pf_users u
      LEFT JOIN pf_quiz_results qr ON qr.user_id = u.id
        AND qr.id = (SELECT MAX(id) FROM pf_quiz_results WHERE user_id = u.id)
      ${where}
    `, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const { rows } = await pool.query(`
      SELECT
        u.id, u.name, ${isCoach ? "" : "u.email, u.phone,"} u.created_at,
        u.verified, u.approval_status, u.location_name, u.neighbourhood,
        qr.quiz_level, qr.real_level, qr.personality_type, qr.completed_at AS quiz_completed_at
      FROM pf_users u
      LEFT JOIN pf_quiz_results qr ON qr.user_id = u.id
        AND qr.id = (SELECT MAX(id) FROM pf_quiz_results WHERE user_id = u.id)
      ${where}
      ORDER BY u.created_at DESC
      LIMIT $${i} OFFSET $${i + 1}
    `, [...params, limit, offset]);

    const users = rows.map((r) => ({
      ...r,
      levelSelf: levelToScore(r.real_level ?? null),
      onboardingStatus: deriveOnboardingStatus({ verified: r.verified, approval_status: r.approval_status }),
    }));

    res.json({ users, total, page, limit });
  } catch (err: any) {
    req.log.error({ err }, "pf admin users error");
    res.status(500).json({ error: "fetch failed" });
  }
}

async function handleUserDetail(req: any, res: any) {
  const auth = req.auth;
  const isCoach = auth.role === "coach";

  try {
    const userResult = await pool.query("SELECT * FROM pf_users WHERE id = $1", [req.params.id]);
    if (!userResult.rows.length) { res.status(404).json({ error: "not found" }); return; }
    const rawUser = userResult.rows[0];

    const quizResult = (await pool.query(
      "SELECT * FROM pf_quiz_results WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [req.params.id]
    )).rows[0] ?? null;

    let matches: unknown[] = [];
    if (rawUser.email) {
      try {
        matches = await findMatchesByEmail(rawUser.email);
      } catch {
        matches = [];
      }
    }

    const user: Record<string, unknown> = {
      id: rawUser.id,
      name: rawUser.name,
      created_at: rawUser.created_at,
      verified: rawUser.verified,
      approval_status: rawUser.approval_status,
      location_name: rawUser.location_name ?? null,
      neighbourhood: rawUser.neighbourhood ?? null,
      availability: (() => {
        try { return JSON.parse(rawUser.availability ?? "[]"); } catch { return []; }
      })(),
      levelSelf: levelToScore(quizResult?.real_level ?? null),
      onboardingStatus: deriveOnboardingStatus({ verified: rawUser.verified, approval_status: rawUser.approval_status }),
    };

    if (!isCoach) {
      user.email = rawUser.email;
      user.phone = rawUser.phone ?? null;
    }

    res.json({ user, quizResult, matches });
  } catch (err: any) {
    req.log.error({ err }, "pf admin user detail error");
    res.status(500).json({ error: "fetch failed" });
  }
}

const EXPORT_PATHS = ["/pf/admin/users/export.csv", "/padel_future/admin/users/export.csv"];
const USERS_LIST_PATHS = ["/pf/admin/users", "/padel_future/admin/users"];
const USER_DETAIL_PATHS = ["/pf/admin/users/:id", "/padel_future/admin/users/:id"];

router.get(EXPORT_PATHS, requireAdminOrCoach, handleExportCsv);
router.get(USERS_LIST_PATHS, requireAdminOrCoach, handleUsersList);
router.get(USER_DETAIL_PATHS, requireAdminOrCoach, handleUserDetail);

export default router;
