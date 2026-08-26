import { Pool, types } from "pg";
import dotenv from "dotenv";

dotenv.config();

// PostgreSQL renvoie les BIGINT (OID 20) comme string par défaut, pour
// éviter de perdre en précision au-delà de Number.MAX_SAFE_INTEGER.
// Nos IDs restent largement dans cette limite pour ce projet, donc on
// force la conversion en number ici, une seule fois pour tout le projet
// -- au lieu que chaque Repositorie doive y penser individuellement.
types.setTypeParser(20, (val: string) => Number(val));

export const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});