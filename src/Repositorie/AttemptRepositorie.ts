
import { Pool } from "pg";
import { Attempt, AttemptRow, mapAttemptRow } from "../Model/Attempt";
import { AnswerRow } from "../Model/Answer";

export class AttemptRepositorie {
  constructor(private db: Pool) {}

  async existsForStudentAndExam(studentId: number, examId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM attempts WHERE student_id = $1 AND exam_id = $2 LIMIT 1`,
      [studentId, examId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findById(attemptId: number): Promise<Attempt | null> {
    const result = await this.db.query<AttemptRow>(
      `SELECT id, student_id, exam_id, score, submitted_at
       FROM attempts WHERE id = $1`,
      [attemptId]
    );
    if (result.rowCount === 0) return null;
    return mapAttemptRow(result.rows[0]);
  }

  async findByStudent(studentId: number): Promise<Attempt[]> {
    const result = await this.db.query<AttemptRow>(
      `SELECT id, student_id, exam_id, score, submitted_at
       FROM attempts WHERE student_id = $1
       ORDER BY submitted_at DESC`,
      [studentId]
    );
    return result.rows.map(mapAttemptRow);
  }

  async findByExam(examId: number): Promise<Attempt[]> {
    const result = await this.db.query<AttemptRow>(
      `SELECT id, student_id, exam_id, score, submitted_at
       FROM attempts WHERE exam_id = $1
       ORDER BY submitted_at ASC`,
      [examId]
    );
    return result.rows.map(mapAttemptRow);
  }

  async findAnswersByAttempt(attemptId: number): Promise<AnswerRow[]> {
    const result = await this.db.query<AnswerRow>(
      `SELECT id, attempt_id, question_id, choice_id
       FROM answers WHERE attempt_id = $1`,
      [attemptId]
    );
    return result.rows;
  }

  async examHasAttempts(examId: number): Promise<boolean> {
    const result = await this.db.query(
      `SELECT 1 FROM attempts WHERE exam_id = $1 LIMIT 1`,
      [examId]
    );
    return (result.rowCount ?? 0) > 0;
  }

 
  async createAttemptWithAnswers(params: {
    studentId: number;
    examId: number;
    score: number;
    answers: { questionId: number; choiceId: number | null }[];
  }): Promise<Attempt> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");

      const attemptResult = await client.query<AttemptRow>(
        `INSERT INTO attempts (student_id, exam_id, score)
         VALUES ($1, $2, $3)
         RETURNING id, student_id, exam_id, score, submitted_at`,
        [params.studentId, params.examId, params.score]
      );
      const attemptRow = attemptResult.rows[0];

      for (const answer of params.answers) {
        await client.query(
          `INSERT INTO answers (attempt_id, question_id, choice_id)
           VALUES ($1, $2, $3)`,
          [attemptRow.id, answer.questionId, answer.choiceId]
        );
      }

      await client.query("COMMIT");
      return mapAttemptRow(attemptRow);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}