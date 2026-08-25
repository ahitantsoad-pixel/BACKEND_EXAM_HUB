import { Request, Response, NextFunction } from "express";
import { ApiError } from "../Security/ApiError";

/**
 * Middleware de vérification de rôle. À utiliser APRÈS requireAuth (qui
 * peuple req.user), sur les routes réservées à un rôle précis :
 *
 *   router.get("/students", requireAuth, requireRole("admin"), StudentController.list);
 *
 * RG-13 : renvoie 403 (pas 401) si l'utilisateur est bien authentifié mais
 * n'a pas le bon rôle -- 401 signifie "je ne sais pas qui tu es",
 * 403 signifie "je sais qui tu es, mais tu n'as pas le droit".
 */
export function requireRole(role: "admin" | "student") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      // Ne devrait jamais arriver si requireAuth est bien placé avant,
      // mais on se protège quand même plutôt que de planter avec un
      // TypeError non géré.
      throw new ApiError(401, "Authentification requise.");
    }

    if (req.user.role !== role) {
      throw new ApiError(403, "Accès refusé : rôle insuffisant.");
    }

    next();
  };
}