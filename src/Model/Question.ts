import { ChoiceAdmin, ChoiceStudent, CreateChoiceInput } from "./Choice";

/*
* Forme envoyée à un administrateur (RG-07 : `correct` est inclus). 
*/

export interface QuestionAdmin {
  id: number;
  examId: number;
  text: string;
  points: number;
  choices: ChoiceAdmin[];
}

/** Forme envoyée à un étudiant (RG-07 : jamais `correct`).*/
export interface QuestionStudent {
  id: number;
  text: string;
  points: number;
  choices: ChoiceStudent[];
}

/*
 * Données nécessaires pour créer une question (POST /api/exams/:id/questions).
 */
export interface CreateQuestionInput {
  text: string;
  points: number;
  choices: CreateChoiceInput[];
}

/**
 * Données pour modifier une question (PUT /api/questions/:id).
 * Si `choices` est fourni, il REMPLACE la liste complète des choix
 */
export interface UpdateQuestionInput {
  text?: string;
  points?: number;
  choices?: CreateChoiceInput[];
}