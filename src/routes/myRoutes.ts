// src/routes/myRoutes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/auth";
import { requireRole } from "../middlewares/requireRole";
import { MyExamController } from "../Controller/MyExamController";

const router = Router();

// Toutes les routes /api/my/* sont réservées aux étudiants authentifiés
router.use(requireAuth, requireRole("student"));

router.get("/exams", MyExamController.listAvailable);
router.get("/exams/:id", MyExamController.getOne);
router.post("/exams/:id/submit", MyExamController.submit);
router.get("/results", MyExamController.listMyResults);
router.get("/results/:attemptId", MyExamController.getMyResultDetail);

export default router;