import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import matchesRouter from "./matches";
import bookingsRouter from "./bookings";
import videoAnalysesRouter from "./video_analyses";
import statsRouter from "./stats";
import coachRouter from "./coach";
import courtsRouter from "./courts";
import matchRequestsRouter from "./match_requests";
import assessmentsRouter from "./assessments";
import adminRouter from "./admin";
import coachingRouter from "./coaching";
import padelRulesRouter from "./padel_rules";
import padelNewsRouter from "./padel_news";
import registrationsRouter from "./registrations";
import padelFutureRouter from "./padel_future";
import trainerMatchRequestsRouter from "./trainer_match_requests";
import matchmakingRouter from "./matchmaking";
import groupTrainingsRouter from "./group_trainings";
import notificationsRouter from "./notifications";
import internalRouter from "./internal";
import recurringSeriesRouter from "./recurring_series";
import inviteRouter from "./invite";
import adminUserProfileRouter from "./admin_user_profile";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// inviteRouter is PUBLIC (new users have no JWT yet). It must be mounted
// before any router that calls `router.use(requireAuth)` at its root —
// otherwise that middleware fires first and rejects /api/invite/* with 401
// before invite's handlers are reached.
router.use(inviteRouter);
router.use(padelFutureRouter);
router.use(statsRouter);
router.use(usersRouter);
router.use(matchesRouter);
router.use(bookingsRouter);
router.use(videoAnalysesRouter);
router.use(coachRouter);
router.use(courtsRouter);
router.use(matchRequestsRouter);
router.use(assessmentsRouter);
router.use(adminRouter);
router.use(adminUserProfileRouter);
router.use(coachingRouter);
router.use(padelRulesRouter);
router.use(padelNewsRouter);
router.use(matchmakingRouter);
router.use(registrationsRouter);
router.use(trainerMatchRequestsRouter);
router.use(groupTrainingsRouter);
router.use(notificationsRouter);
router.use(internalRouter);
router.use(recurringSeriesRouter);

export default router;
