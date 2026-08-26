import { pool } from "../config/db";
import { Course } from "../Model/Course";

export const CourseRepositorie = {
  async findAll(): Promise<Course[]> {
    const result = await pool.query<Course>("SELECT * FROM courses ORDER BY id");
    return result.rows;
  },

  async findById(id: number): Promise<Course | null> {
    const result = await pool.query<Course>(
      "SELECT * FROM courses WHERE id = $1",
      [id]
    );
    return result.rows[0] ?? null;
  },

  async findByCode(code: string): Promise<Course | null> {
    const result = await pool.query<Course>(
      "SELECT * FROM courses WHERE code = $1",
      [code]
    );
    return result.rows[0] ?? null;
  },

  async create(data: { code: string; name: string; description: string }): Promise<Course> {
    const result = await pool.query<Course>(
      `INSERT INTO courses (code, name, description)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [data.code, data.name, data.description]
    );
    return result.rows[0]!;
  },

  async update(
    id: number,
    data: Partial<{ code: string; name: string; description: string }>
  ): Promise<Course | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.code !== undefined) {
      fields.push(`code = $${idx++}`);
      values.push(data.code);
    }
    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query<Course>(
      `UPDATE courses SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      values
    );
    return result.rows[0] ?? null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await pool.query("DELETE FROM courses WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  },

  async hasExams(id: number): Promise<boolean> {
    const result = await pool.query(
      "SELECT 1 FROM exams WHERE course_id = $1 LIMIT 1",
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  },
};