import { Router } from "express";
import { QuestionController } from "../Controller/QuestionController";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.put("/:id", QuestionController.update);
router.delete("/:id", QuestionController.remove);

export default router;