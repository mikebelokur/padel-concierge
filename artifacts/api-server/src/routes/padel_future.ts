import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

router.post("/pf/register", async (req, res) => {
  const { name, email, phone } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: "name and email are required" });
    return;
  }
  try {
    await pool.query(
      "INSERT INTO pf_users (name, email, phone) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
      [name, email, phone || ""]
    );
    const userRes = await pool.query(
      "SELECT * FROM pf_users WHERE email = $1",
      [email]
    );
    const user = userRes.rows[0];
    const quizRes = await pool.query(
      "SELECT * FROM pf_quiz_results WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [user.id]
    );
    const quizResult = quizRes.rows[0] || null;
    res.json({ user, quizResult });
  } catch (err: any) {
    req.log.error({ err }, "pf register error");
    res.status(500).json({ error: "registration failed" });
  }
});

router.post("/pf/quiz", async (req, res) => {
  const {
    userId, quizLevel, realLevel, personalityType,
    q1Answer, q2Answer, q3Answer,
    q4Answer, q4Extra,
    q5Answer, q6Answer, q7Answer, q8Answer, q9Answer, q10Answer,
  } = req.body;

  if (!userId || !quizLevel || !realLevel) {
    res.status(400).json({ error: "userId, quizLevel, realLevel required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO pf_quiz_results
        (user_id, quiz_level, real_level, personality_type,
         q1_answer, q2_answer, q3_answer,
         q4_answer, q4_extra, q5_answer, q6_answer, q7_answer, q8_answer, q9_answer, q10_answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       RETURNING *`,
      [
        userId, quizLevel, realLevel, personalityType || null,
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

router.get("/pf/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const userRes = await pool.query("SELECT * FROM pf_users WHERE id = $1", [id]);
    if (!userRes.rows.length) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const quizRes = await pool.query(
      "SELECT * FROM pf_quiz_results WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [id]
    );
    res.json({ user: userRes.rows[0], quizResult: quizRes.rows[0] || null });
  } catch (err: any) {
    req.log.error({ err }, "pf get user error");
    res.status(500).json({ error: "fetch failed" });
  }
});

router.get("/pf/admin", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id, u.name, u.email, u.phone, u.created_at,
        qr.real_level, qr.quiz_level, qr.personality_type, qr.completed_at as quiz_completed_at
      FROM pf_users u
      LEFT JOIN pf_quiz_results qr ON qr.user_id = u.id
        AND qr.id = (
          SELECT id FROM pf_quiz_results
          WHERE user_id = u.id
          ORDER BY completed_at DESC LIMIT 1
        )
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows, total: result.rows.length });
  } catch (err: any) {
    req.log.error({ err }, "pf admin error");
    res.status(500).json({ error: "fetch failed" });
  }
});

export default router;
