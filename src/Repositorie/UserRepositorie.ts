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

  async findAllStudents(): Promise<User[]> {
    const result = await pool.query<User>(
      "SELECT * FROM users WHERE role = 'student' ORDER BY id"
    );
    return result.rows;
  },

  async create(data: {
    name: string;
    email: string;
    password_hash: string;
    role: "admin" | "student";
  }): Promise<User> {
    const result = await pool.query<User>(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING *`,
      [data.name, data.email, data.password_hash, data.role]
    );
    return result.rows[0]!;
  },

  async update(
    id: number,
    data: Partial<{ name: string; email: string }>
  ): Promise<User | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.email !== undefined) {
      fields.push(`email = $${idx++}`);
      values.push(data.email);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query<User>(
      `UPDATE users SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  },

  async updatePasswordHash(id: number, passwordHash: string): Promise<void> {
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      id,
    ]);
  },

  async setActive(id: number, isActive: boolean): Promise<User | null> {
    const result = await pool.query<User>(
      "UPDATE users SET is_active = $1 WHERE id = $2 RETURNING *",
      [isActive, id]
    );
    return result.rows[0] ?? null;
  },
};