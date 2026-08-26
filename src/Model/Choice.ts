/** Forme complète, réservée à la vue admin (GET /api/exams/:id/questions). */
export interface ChoiceAdmin {
  id: number;
  questionId: number;
  text: string;
  correct: boolean;
}

/**
 * Forme envoyée à un étudiant (via GET /api/my/exams/:id 
 * RG-07 s'applique : `correct` n'est jamais exposé côté étudiant).
 */
export interface ChoiceStudent {
  id: number;
  text: string;
}

/** Données nécessaires pour créer un choix, dans le cadre de CreateQuestionInput. */
export interface CreateChoiceInput {
  text: string;
  correct: boolean;
}

/**
 * Convertit un ChoiceAdmin en ChoiceStudent -- fonction utilitaire pure,
 */
export function toChoiceStudent(choice: ChoiceAdmin): ChoiceStudent {
  return { id: choice.id, text: choice.text };
}