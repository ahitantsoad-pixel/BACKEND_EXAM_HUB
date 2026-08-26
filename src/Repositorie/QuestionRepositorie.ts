import { PoolClient } from "pg";
import { pool } from "../config/db";
import { QuestionAdmin, CreateQuestionInput, UpdateQuestionInput } from "../Model/Question";
import { ChoiceAdmin, CreateChoiceInput } from "../Model/Choice";


/** Une ligne brute renvoyée par le JOIN questions + choices. */
interface QuestionChoiceRow {
  q_id: number;
  q_exam_id: number;
  q_text: string;
  q_points: number;
  c_id: number;
  c_question_id: number;
  c_text: string;
  c_correct: boolean;
}

/**
 * Regroupe des lignes plates (1 ligne par choix, question dupliquée sur
 * chaque ligne à cause du JOIN) en QuestionAdmin[] avec choices imbriqués.
 * SQL renvoie des lignes plates, mais l'API doit renvoyer des questions
 * avec leur tableau de choix -- ce regroupement se fait ici, une seule
 * fois, plutôt que dupliqué dans chaque fonction qui en a besoin.
 * 
 * C'est pour suivre à bien ce que notre prof nous a demander ici :  RG-04 — 
 * Une question possède entre 2 et 6 choix, dont exactement un correct. 
 * Toute violation est refusée par le serveur.
 */

function groupRowsIntoQuestions(rows: QuestionChoiceRow[]): QuestionAdmin[] {
  const questionsById = new Map<number, QuestionAdmin>();

  for (const row of rows) {
    let question = questionsById.get(row.q_id);
    if (!question) {
      question = {
        id: row.q_id,
        examId: row.q_exam_id,
        text: row.q_text,
        points: row.q_points,
        choices: [],
      };
      questionsById.set(row.q_id, question);
    }

     
    if (row.c_id !== null) {
      question.choices.push({
        id: row.c_id,
        questionId: row.c_question_id,
        text: row.c_text,
        correct: row.c_correct,
      });
    }
  }

  return Array.from(questionsById.values());
}

export const QuestionRepositorie = {
  /** Liste toutes les questions d'un examen, avec leurs choix. */
  async findByExamId(examId: number): Promise<QuestionAdmin[]> {
    const result = await pool.query<QuestionChoiceRow>(
      `SELECT
         q.id AS q_id, q.exam_id AS q_exam_id, q.text AS q_text, q.points AS q_points,
         c.id AS c_id, c.question_id AS c_question_id, c.text AS c_text, c.correct AS c_correct
       FROM questions q
       LEFT JOIN choices c ON c.question_id = q.id
       WHERE q.exam_id = $1
       ORDER BY q.id, c.id`,
      [examId]
    );
    return groupRowsIntoQuestions(result.rows);
  },

  /** Renvoie une question précise avec ses choix, ou null si elle n'existe pas. */
  async findById(id: number): Promise<QuestionAdmin | null> {
    const result = await pool.query<QuestionChoiceRow>(
      `SELECT
         q.id AS q_id, q.exam_id AS q_exam_id, q.text AS q_text, q.points AS q_points,
         c.id AS c_id, c.question_id AS c_question_id, c.text AS c_text, c.correct AS c_correct
       FROM questions q
       LEFT JOIN choices c ON c.question_id = q.id
       WHERE q.id = $1
       ORDER BY c.id`,
      [id]
    );
    const questions = groupRowsIntoQuestions(result.rows);
    return questions[0] ?? null;
  },

   
  async create(examId: number, data: CreateQuestionInput): Promise<QuestionAdmin> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const questionResult = await client.query(
        `INSERT INTO questions (exam_id, text, points)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [examId, data.text, data.points]
      );
      const questionId: number = questionResult.rows[0].id;

      const choices = await insertChoices(client, questionId, data.choices);

      await client.query("COMMIT");

      return {
        id: questionId,
        examId,
        text: data.text,
        points: data.points,
        choices,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },

  
  async update(id: number, data: UpdateQuestionInput): Promise<QuestionAdmin | null> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const fields: string[] = [];
      const values: unknown[] = [];
      let paramIndex = 1;

      if (data.text !== undefined) {
        fields.push(`text = $${paramIndex++}`);
        values.push(data.text);
      }
      if (data.points !== undefined) {
        fields.push(`points = $${paramIndex++}`);
        values.push(data.points);
      }

      if (fields.length > 0) {
        values.push(id);
        const updateResult = await client.query(
          `UPDATE questions SET ${fields.join(", ")} WHERE id = $${paramIndex} RETURNING id`,
          values
        );
        if (updateResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }
      } else {
         
        const existsResult = await client.query(`SELECT id FROM questions WHERE id = $1`, [id]);
        if (existsResult.rowCount === 0) {
          await client.query("ROLLBACK");
          return null;
        }
      }

      let choices: ChoiceAdmin[];
      if (data.choices !== undefined) {
        await client.query(`DELETE FROM choices WHERE question_id = $1`, [id]);
        choices = await insertChoices(client, id, data.choices);
      } else {
        const existingChoices = await client.query(
          `SELECT id, question_id, text, correct FROM choices WHERE question_id = $1 ORDER BY id`,
          [id]
        );
        choices = existingChoices.rows.map((r) => ({
          id: r.id,
          questionId: r.question_id,
          text: r.text,
          correct: r.correct,
        }));
      }

      await client.query("COMMIT");

      const questionRow = await pool.query(`SELECT exam_id, text, points FROM questions WHERE id = $1`, [id]);
      return {
        id,
        examId: questionRow.rows[0].exam_id,
        text: questionRow.rows[0].text,
        points: questionRow.rows[0].points,
        choices,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  },
 
  async delete(id: number): Promise<boolean> {
    const result = await pool.query(`DELETE FROM questions WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  },

 
  async findExamIdByQuestionId(questionId: number): Promise<number | null> {
    const result = await pool.query(`SELECT exam_id FROM questions WHERE id = $1`, [questionId]);
    return result.rows[0]?.exam_id ?? null;
  },
};
 
async function insertChoices(
  client: PoolClient,
  questionId: number,
  choices: CreateChoiceInput[]
): Promise<ChoiceAdmin[]> {
  const inserted: ChoiceAdmin[] = [];
  for (const choice of choices) {
    const result = await client.query(
      `INSERT INTO choices (question_id, text, correct)
       VALUES ($1, $2, $3)
       RETURNING id, question_id, text, correct`,
      [questionId, choice.text, choice.correct]
    );
    const row = result.rows[0];
    inserted.push({
      id: row.id,
      questionId: row.question_id,
      text: row.text,
      correct: row.correct,
    });
  }
  return inserted;
}