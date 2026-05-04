import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import matchesRouter from "./matches";
import bookingsRouter from "./bookings";
import videoAnalysesRouter from "./video_analyses";
import statsRouter from "./stats";
import coachRouter from "./coach";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(usersRouter);
router.use(matchesRouter);
router.use(bookingsRouter);
router.use(videoAnalysesRouter);
router.use(statsRouter);
router.use(coachRouter);

export default router;
