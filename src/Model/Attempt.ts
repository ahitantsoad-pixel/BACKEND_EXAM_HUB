export interface Attempt {
  id: number;
  studentId: number;
  examId: number;
  score: number;
  totalPoints: number;
  submittedAt: string; 
}

export interface AttemptRow {
  id: number;
  student_id: number;
  exam_id: number;
  score: number;
  total_points: number;
  submitted_at: Date;
}

export function mapAttemptRow(row: AttemptRow): Attempt {
  return {
    id: row.id,
    studentId: row.student_id,
    examId: row.exam_id,
    score: row.score,
    totalPoints: row.total_points,
    submittedAt: row.submitted_at.toISOString(),
  };
}