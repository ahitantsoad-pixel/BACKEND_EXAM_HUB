import { Router } from "express";
import authRoutes from "./authRoutes";
import studentRoutes from "./studentRoutes";
import courseRoutes from "./courseRoutes";

/**
 * Point de montage central de toutes les routes /api/*.
 *
 * Chacun ajoute son propre fichier de routes ici, sans toucher aux lignes
 * des autres :
 *   - BE1  : authRoutes, studentRoutes, courseRoutes
 *   - BE2  : examRoutes, questionRoutes   <- vous
 *   - BE3  : myRoutes
 *
 * Exemple, une fois vos routes prêtes :
 *   import examRoutes from "./examRoutes";
 *   router.use("/exams", examRoutes);
 */
const router = Router();

// À décommenter/compléter au fur et à mesure que chaque domaine avance :
router.use("/auth", authRoutes);
router.use("/students", studentRoutes);
router.use("/courses", courseRoutes);
// router.use("/exams", examRoutes);
// router.use("/questions", questionRoutes);
// router.use("/my", myRoutes);

export default router;