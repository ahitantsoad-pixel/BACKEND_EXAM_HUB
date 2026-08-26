/*
Model Exam
*/
export interface Exam {
  id: number;
  courseId: number;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
}

/*
Donnée pour la creation d'un examen (POST /api/exams) 
 */
export interface CreateExamInput {
  courseId: number;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
}

/*
Données pour MODIFIER un examen (PUT /api/exams/:id).
 */
export interface UpdateExamInput {
  courseId?: number;
  title?: string;
  description?: string;
  startsAt?: Date;
  endsAt?: Date;
}

/**
 * Forme enrichie utilisée par GET /api/my/exams côté BE3 (courseName ajouté
 * par une jointure)
 */
export interface ExamWithCourseName extends Exam {
  courseName: string;
}