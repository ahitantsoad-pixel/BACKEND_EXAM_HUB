import { Request, Response, NextFunction } from "express";
import { ApiError } from "../Security/ApiError";
import { verifyToken, JwtPayload } from "../Security/jwt";

/**
 * Étend le type Request d'Express pour porter l'utilisateur authentifié
 * une fois le token vérifié. Utilisé par requireRole.ts et par les
 * Controllers qui ont besoin de savoir "qui" fait la requête (ex. /api/my/*).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware d'authentification : vérifie la présence et la validité du
 * header "Authorization: Bearer <token>".
 *
 * À appliquer sur TOUTES les routes sauf POST /api/auth/login (RG-13 : 401
 * si non authentifié).
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentification requise.");
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new ApiError(401, "Token invalide ou expiré.");
  }
}