import { pool } from "../config/db";
import { Exam, CreateExamInput, UpdateExamInput } from "../Model/Exam";

/**
 * Accès SQL brut à la table `exams`. Aucun ORM (contrainte du sujet) :
 * toutes les requêtes sont écrites à la main, systématiquement paramétrées
 * ($1, $2...) pour éviter toute injection SQL.
 * 
/** Convertit une ligne brute renvoyée par `pg` (snake_case) en Exam (camelCase). */
function mapRow(row: {
  id: number;
  course_id: number;
  title: string;
  description: string;
  starts_at: Date;
  ends_at: Date;
}): Exam {
  return {
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
  };
}

export const ExamRepositorie = {
  /**
   * Liste tous les examens, avec filtre optionnel par cours
   * (GET /api/exams?courseId=... -- décision de conception documentée
   * dans notre contrat que j'ai mis dans notre repository).
   */
  async findAll(courseId?: number): Promise<Exam[]> {
    if (courseId !== undefined) {
      const result = await pool.query(
        `SELECT id, course_id, title, description, starts_at, ends_at
         FROM exams
         WHERE course_id = $1
         ORDER BY starts_at DESC`,
        [courseId]
      );
      return result.rows.map(mapRow);
    }

    const result = await pool.query(
      `SELECT id, course_id, title, description, starts_at, ends_at
       FROM exams
       ORDER BY starts_at DESC`
    );
    return result.rows.map(mapRow);
  },

  /** Renvoie un examen par id, ou null s'il n'existe pas. */
  async findById(id: number): Promise<Exam | null> {
    const result = await pool.query(
      `SELECT id, course_id, title, description, starts_at, ends_at
       FROM exams
       WHERE id = $1`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  /*
   * Insère un nouvel examen. Renvoie l'examen créé, avec son id auto-incrémenté.
   */
  async create(data: CreateExamInput): Promise<Exam> {
    const result = await pool.query(
      `INSERT INTO exams (course_id, title, description, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, course_id, title, description, starts_at, ends_at`,
      [data.courseId, data.title, data.description, data.startsAt, data.endsAt]
    );
    return mapRow(result.rows[0]);
  },

  /**
   * Met à jour partiellement un examen. Construit dynamiquement la requête
   * Renvoie null si l'examen n'existe pas (Service traduira en 404).
   */
  async update(id: number, data: UpdateExamInput): Promise<Exam | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.courseId !== undefined) {
      fields.push(`course_id = $${paramIndex++}`);
      values.push(data.courseId);
    }
    if (data.title !== undefined) {
      fields.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.startsAt !== undefined) {
      fields.push(`starts_at = $${paramIndex++}`);
      values.push(data.startsAt);
    }
    if (data.endsAt !== undefined) {
      fields.push(`ends_at = $${paramIndex++}`);
      values.push(data.endsAt);
    }

 
    if (fields.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const result = await pool.query(
      `UPDATE exams
       SET ${fields.join(", ")}
       WHERE id = $${paramIndex}
       RETURNING id, course_id, title, description, starts_at, ends_at`,
      values
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  },

  /*
   * Supprime un examen.  
   * Renvoie true si une ligne a bien été supprimée, false si l'id n'existait pas.
   */
  async delete(id: number): Promise<boolean> {
    const result = await pool.query(`DELETE FROM exams WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Vérifie l'existence d'un cours.
   */
  async courseExists(courseId: number): Promise<boolean> {
    const result = await pool.query(`SELECT 1 FROM courses WHERE id = $1`, [courseId]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Vérifie si un examen a au moins une tentative -- utilisé par
   * ExamService pour RG-09 (suppression bloquée) avant même de tenter le
   * DELETE, pour renvoyer un message d'erreur métier clair.
   * Comme la dit notre prof WEB2 que "RG-09 — Un cours qui possède des examens ne peut pas être supprimé ;
   *un examen qui possède des tentatives non plus."
   */
  async hasAttempts(examId: number): Promise<boolean> {
    const result = await pool.query(`SELECT 1 FROM attempts WHERE exam_id = $1 LIMIT 1`, [examId]);
    return (result.rowCount ?? 0) > 0;
  },
};