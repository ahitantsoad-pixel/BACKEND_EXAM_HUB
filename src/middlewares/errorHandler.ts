import { Request, Response, NextFunction } from "express";
import { ApiError } from "../Security/ApiError";

/**
 * Middleware global de gestion d'erreurs (RG-13).
 *
 * DOIT être enregistré en DERNIER dans app.ts, après toutes les routes —
 * c'est une règle d'Express : un middleware à 4 paramètres (err, req, res, next)
 * n'est appelé que lorsqu'un précédent maillon a fait next(err) ou lancé une
 * exception dans une route async correctement catchée.
 *
 * Toute erreur qui arrive ici est transformée en :
 *   { "message": "..." }
 * avec le bon code HTTP :
 *   - ApiError connue (levée volontairement par un Service) -> son .status
 *   - Erreur PostgreSQL de contrainte unique (23505)          -> 409
 *   - Erreur PostgreSQL de contrainte FK/NOT NULL, etc.        -> 400
 *   - Tout le reste (bug non prévu)                            -> 500
 *
 * Le 500 n'est volontairement PAS dans la liste RG-13 (400/401/403/404/409),
 * mais un bug non anticipé ne doit jamais faire planter le serveur sans
 * réponse propre au client -- 500 est le filet de sécurité générique.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Erreur métier levée volontairement (cas normal et attendu)
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  // Erreur PostgreSQL : contrainte unique violée (ex. RG-02 double tentative,
  // email déjà utilisé, code cours déjà utilisé...)
  if (isPgError(err) && err.code === "23505") {
    res.status(409).json({ message: "Cette ressource existe déjà ou entre en conflit." });
    return;
  }

  // Erreur PostgreSQL : violation de clé étrangère ou de contrainte CHECK
  // (ex. courseId inexistant, dates d'examen incohérentes, points <= 0...)
  if (isPgError(err) && (err.code === "23503" || err.code === "23514")) {
    res.status(400).json({ message: "Données invalides." });
    return;
  }

  // Erreur totalement imprévue : on logge côté serveur pour debug, mais on
  // ne renvoie jamais la stack trace ou le détail interne au client.
  // eslint-disable-next-line no-console
  console.error("Erreur non gérée :", err);
  res.status(500).json({ message: "Erreur interne du serveur." });
}

/** Garde de type minimale pour reconnaître une erreur émise par le driver pg. */
function isPgError(err: unknown): err is { code: string } {
  return typeof err === "object" && err !== null && "code" in err && typeof (err as { code: unknown }).code === "string";
}