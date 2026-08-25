
export interface SubmittedAnswer {
  questionId: number;
  choiceId: number | null;
}

export interface AnswerCorrection {
  questionId: number;
  questionText: string;
  points: number;
  choiceId: number | null;
  correctChoiceId: number;
  isCorrect: boolean;
  choices: { id: number; text: string; correct: boolean }[];
}

export interface AnswerRow {
  id: number;
  attempt_id: number;
  question_id: number;
  choice_id: number | null;
  is_correct: boolean;
  points_earned: number;
}