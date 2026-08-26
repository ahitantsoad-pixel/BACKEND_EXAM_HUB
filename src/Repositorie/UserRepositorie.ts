import { pool } from "../config/db";
import { User } from "../Model/User";

export const UserRepositorie = {
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query<User>(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );
    return result.rows[0] ?? null;
  },

  async findById(id: number): Promise<User | null> {
    const result = await pool.query<User>(
      "SELECT * FROM users WHERE id = $1",
      [id]
    );
    return result.rows[0] ?? null;
  },
};