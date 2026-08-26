import { Router } from "express";
import { StudentController } from "../Controller/StudentController";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";

const router = Router();

router.use(requireAuth, requireRole("admin"));

router.get("/", StudentController.getAll);
router.post("/", StudentController.create);
router.put("/:id", StudentController.update);
router.post("/:id/reset-password", StudentController.resetPassword);
router.delete("/:id", StudentController.deactivate);

export default router;