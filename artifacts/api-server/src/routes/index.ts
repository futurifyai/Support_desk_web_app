import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import ticketsRouter from "./tickets";
import adminRouter from "./admin";
import helpRouter from "./help";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(ticketsRouter);
router.use(adminRouter);
router.use(helpRouter);
router.use(usersRouter);

export default router;
