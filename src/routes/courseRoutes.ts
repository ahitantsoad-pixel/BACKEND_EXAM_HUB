import { Router } from "express";
import { CourseController } from "../Controller/CourseController";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", CourseController.getAll);
router.post("/", CourseController.create);
router.put("/:id", CourseController.update);
router.delete("/:id", CourseController.delete);

export default router;