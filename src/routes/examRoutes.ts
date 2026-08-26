import { Router } from "express";
import { ExamController } from "../Controller/ExamController";
import { QuestionController } from "../Controller/QuestionController";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";

const router = Router();

// Toutes les routes /api/exams/* sont réservées à l'admin (Section 5 du sujet)
router.use(requireAuth, requireRole("admin"));

// --- Routes sur la collection /exams ---
router.get("/", ExamController.findAll);
router.post("/", ExamController.create);

// --- Routes sur un exam précis /exams/:id ---
router.get("/:id", ExamController.findById);
router.put("/:id", ExamController.update);
router.delete("/:id", ExamController.remove);

// --- Routes imbriquées /exams/:id/questions ---
router.get("/:id/questions", QuestionController.findAllByExam);
router.post("/:id/questions", QuestionController.create);

export default router;