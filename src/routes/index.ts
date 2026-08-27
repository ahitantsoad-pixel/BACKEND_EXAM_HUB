import { Router } from "express";
import authRoutes from "./authRoutes";
import studentRoutes from "./studentRoutes";
import courseRoutes from "./courseRoutes";
import examRoutes from "./examRoutes";
import questionRoutes from "./questionRoutes";
import myRoutes from "./myRoutes";

/**
 * Point de montage central de toutes les routes /api/*.
 *
 * Chacun ajoute son propre fichier de routes ici, sans toucher aux lignes
 * des autres :
 *   - BE1  : authRoutes, studentRoutes, courseRoutes
 *   - BE2  : examRoutes, questionRoutes   <- vous
 *   - BE3  : myRoutes
 */
const router = Router();

router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/courses", courseRoutes);
router.use("/exams", examRoutes);
router.use("/questions", questionRoutes);
router.use("/my", myRoutes);

export default router;