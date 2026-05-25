import { Router, type IRouter } from "express";
import { runGroupTrainingTick } from "../lib/groupTrainingScheduler";

const router: IRouter = Router();

router.post("/internal/tick", async (req, res): Promise<void> => {
  const expected = process.env["INTERNAL_TICK_TOKEN"];
  if (!expected) {
    res.status(503).json({ error: "INTERNAL_TICK_TOKEN not configured" });
    return;
  }
  const header = req.header("x-internal-token") ?? "";
  if (header !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const result = await runGroupTrainingTick();
    req.log?.info(result, "internal_tick");
    res.json({ ok: true, ...result });
  } catch (err) {
    req.log?.error({ err }, "internal_tick failed");
    res.status(500).json({ error: "tick failed" });
  }
});

export default router;
