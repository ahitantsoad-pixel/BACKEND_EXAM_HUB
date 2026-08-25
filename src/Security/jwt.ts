import jwt from "jsonwebtoken";

/**
 * Contenu (payload) encodé dans le JWT. Décision d'équipe : durée de vie
 * de 24h (JWT_EXPIRES_IN dans .env), clé "token" dans la réponse de login.
 */
export interface JwtPayload {
  id: number;
  role: "admin" | "student";
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

if (!JWT_SECRET) {
  // On échoue vite et fort au démarrage plutôt que de signer des tokens
  // avec un secret vide/undefined, qui serait une faille de sécurité
  // silencieuse.
  throw new Error("JWT_SECRET manquant dans les variables d'environnement.");
}

/** Génère un token signé pour un utilisateur donné, après login réussi. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET as string, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

/**
 * Vérifie et décode un token. Lance une erreur (jsonwebtoken natif) si le
 * token est invalide, mal signé, ou expiré -- à catcher dans le middleware
 * auth.ts qui traduit ça en ApiError(401, ...).
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET as string) as JwtPayload;
}