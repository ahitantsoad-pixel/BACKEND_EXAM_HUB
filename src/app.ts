import express, { Express, Request, Response } from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import routes from "./routes";

export function createApp(): Express {
  const app = express();

  // CORS : autorise le frontend (Vite, localhost:5173 par défaut) à appeler
  // cette API depuis un port différent.
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
    })
  );

  // Parse les bodies JSON entrants (POST/PUT students, exams, questions...).
  app.use(express.json());

  // Route de santé, utile pour vérifier rapidement que le serveur tourne
  // (ex. avec curl http://localhost:3000/health) sans toucher à la logique
  // métier ni à la base de données.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok" });
  });

  // Toutes les routes métier sont préfixées par /api, comme imposé par le
  // sujet (section 5 : "L'API est préfixée par /api").
  app.use("/api", routes);

  // IMPORTANT : le errorHandler doit être enregistré en tout dernier,
  // après app.use("/api", routes) -- sinon Express ne le reconnaît pas
  // comme middleware d'erreur.
  app.use(errorHandler);

  return app;
}