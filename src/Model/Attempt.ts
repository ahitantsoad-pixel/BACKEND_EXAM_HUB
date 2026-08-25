// src/Model/Attempt.ts

export interface Attempt {
  id: number;
  studentId: number;
  examId: number;
  score: number;
  submittedAt: string; 
}

export interface AttemptRow {
  id: string | number;      
  student_id: string | number;
  exam_id: string | number;
  score: number;
  submitted_at: Date;
}

export function mapAttemptRow(row: AttemptRow): Attempt {
  return {
    id: Number(row.id),
    studentId: Number(row.student_id),
    examId: Number(row.exam_id),
    score: row.score,
    submittedAt: row.submitted_at.toISOString(),
  };
}