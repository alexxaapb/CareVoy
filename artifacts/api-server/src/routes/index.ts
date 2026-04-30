import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai";
import paymentsRouter from "./payments";

const router: IRouter = Router();

router.use(healthRouter);
router.use(aiRouter);
router.use(paymentsRouter);

export default router;
