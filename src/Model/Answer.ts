
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
  id: string | number;
  attempt_id: string | number;
  question_id: string | number;
  choice_id: string | number | null;
}