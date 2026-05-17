import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth, requireAdmin } from "../middleware/auth";

const router = Router();

router.post("/pf/quiz", requireAuth, async (req, res) => {
  const {
    sessionId, quizLevel, realLevel, personalityType,
    q1Answer, q2Answer, q3Answer,
    q4Answer, q4Extra,
    q5Answer, q6Answer, q7Answer, q8Answer, q9Answer, q10Answer,
  } = req.body;

  if (!sessionId || !quizLevel || !realLevel) {
    res.status(400).json({ error: "sessionId, quizLevel, realLevel required" });
    return;
  }
  try {
    const result = await pool.query(
      `INSERT INTO pf_quiz_results
        (session_id, quiz_level, real_level, personality_type,
         q1_answer, q2_answer, q3_answer,
         q4_answer, q4_extra, q5_answer, q6_answer, q7_answer, q8_answer, q9_answer, q10_answer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [
        sessionId, quizLevel, realLevel, personalityType || null,
        q1Answer ?? null, q2Answer ?? null, q3Answer ?? null,
        q4Answer || null, q4Extra || null,
        q5Answer || null, q6Answer || null, q7Answer || null,
        q8Answer || null, q9Answer || null, q10Answer || null,
      ]
    );
    const row = result.rows[0] ?? (await pool.query(
      "SELECT * FROM pf_quiz_results WHERE session_id = $1 ORDER BY completed_at DESC LIMIT 1",
      [sessionId]
    )).rows[0];
    res.status(201).json(row);
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

router.get("/pf/admin", requireAdmin, async (req, res) => {
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

export default router;
