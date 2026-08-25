import { AttemptRepositorie } from "../Repositorie/AttemptRepositorie";
import { Attempt } from "../Model/Attempt";
import { SubmittedAnswer, AnswerCorrection, AnswerRow } from "../Model/Answer";

export interface ExamForAttempt {
  id: number;
  courseId: number;
  courseName?: string;
  title: string;
  startsAt: string;
  endsAt: string;
}

export interface ChoiceForAttempt {
  id: number;
  text: string;
  correct: boolean;
}

export interface QuestionForAttempt {
  id: number;
  text: string;
  points: number;
  choices: ChoiceForAttempt[];
}

export interface ExamRepositorieLike {
  findById(examId: number): Promise<ExamForAttempt | null>;
}

export interface QuestionRepositorieLike {
  findByExam(examId: number): Promise<QuestionForAttempt[]>;
}

export class ServiceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export class AttemptService {
  constructor(
    private attemptRepo: AttemptRepositorie,
    private examRepo: ExamRepositorieLike,
    private questionRepo: QuestionRepositorieLike
  ) {}

  /** GET /api/my/exams */
  async getAvailableExams(studentId: number, allExams: ExamForAttempt[]): Promise<ExamForAttempt[]> {
    const now = new Date();
    const available: ExamForAttempt[] = [];
    for (const exam of allExams) {
      const inWindow = new Date(exam.startsAt) <= now && now <= new Date(exam.endsAt);
      if (!inWindow) continue;
      const already = await this.attemptRepo.existsForStudentAndExam(studentId, exam.id);
      if (!already) available.push(exam);
    }
    return available;
  }

  /** GET /api/my/exams/:id */
  async getExamForStudent(studentId: number, examId: number) {
    const exam = await this.examRepo.findById(examId);
    if (!exam) throw new ServiceError(404, "Examen introuvable.");

    this.assertWithinWindow(exam);

    const already = await this.attemptRepo.existsForStudentAndExam(studentId, examId);
    if (already) throw new ServiceError(409, "Vous avez déjà passé cet examen.");

    const questions = await this.questionRepo.findByExam(examId);
    return {
      ...exam,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        points: q.points,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text })), // jamais "correct" (RG-07)
      })),
    };
  }

  /** POST /api/my/exams/:id/submit */
  async submitExam(
    studentId: number,
    examId: number,
    body: { answers: SubmittedAnswer[] }
  ): Promise<{
    attemptId: number;
    score: number;
    totalPoints: number;
    submittedAt: string;
    answers: AnswerCorrection[];
  }> {
    const exam = await this.examRepo.findById(examId);
    if (!exam) throw new ServiceError(404, "Examen introuvable.");

    this.assertWithinWindow(exam); // RG-03, revérifié à la soumission

    const already = await this.attemptRepo.existsForStudentAndExam(studentId, examId);
    if (already) throw new ServiceError(409, "Vous avez déjà passé cet examen."); // RG-02

    const questions = await this.questionRepo.findByExam(examId);
    if (questions.length === 0) throw new ServiceError(400, "Cet examen n'a aucune question.");

    const questionIds = new Set(questions.map((q) => q.id));
    for (const a of body.answers) {
      if (!questionIds.has(a.questionId)) {
        throw new ServiceError(400, "Réponse invalide pour une ou plusieurs questions.");
      }
      if (a.choiceId !== null) {
        const question = questions.find((q) => q.id === a.questionId)!;
        const validChoice = question.choices.some((c) => c.id === a.choiceId);
        if (!validChoice) {
          throw new ServiceError(400, "Réponse invalide pour une ou plusieurs questions.");
        }
      }
    }

    // RG-06 : calcul du score UNIQUEMENT côté serveur — rien de tout ça n'est stocké en base,
    // isCorrect/points sont dérivés à la volée à partir de questions/choices
    let score = 0;
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const answerCorrections: AnswerCorrection[] = [];
    const answersToPersist: { questionId: number; choiceId: number | null }[] = [];

    for (const question of questions) {
      const submitted = body.answers.find((a) => a.questionId === question.id);
      const correctChoice = question.choices.find((c) => c.correct)!;
      const choiceId = submitted?.choiceId ?? null; // RG-05
      const isCorrect = choiceId !== null && choiceId === correctChoice.id;
      if (isCorrect) score += question.points;

      answerCorrections.push({
        questionId: question.id,
        questionText: question.text,
        points: question.points,
        choiceId,
        correctChoiceId: correctChoice.id,
        isCorrect,
        choices: question.choices,
      });

      // seul questionId/choiceId est persisté — is_correct/points n'existent plus en base
      answersToPersist.push({ questionId: question.id, choiceId });
    }

    const attempt: Attempt = await this.attemptRepo.createAttemptWithAnswers({
      studentId,
      examId,
      score,
      answers: answersToPersist,
    });

    return {
      attemptId: attempt.id,
      score: attempt.score,
      totalPoints, // recalculé, jamais stocké dans attempts
      submittedAt: attempt.submittedAt,
      answers: answerCorrections, // RG-12
    };
  }

  /** GET /api/my/results */
  async getMyResults(studentId: number) {
    const attempts = await this.attemptRepo.findByStudent(studentId);
    const results = [];
    for (const attempt of attempts) {
      const exam = await this.examRepo.findById(attempt.examId);
      const questions = await this.questionRepo.findByExam(attempt.examId);
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      results.push({
        attemptId: attempt.id,
        examId: attempt.examId,
        examTitle: exam?.title ?? "",
        courseName: exam?.courseName ?? "",
        score: attempt.score,
        totalPoints,
        submittedAt: attempt.submittedAt,
      });
    }
    return results;
  }

  /** GET /api/my/results/:attemptId */
  async getMyResultDetail(studentId: number, attemptId: number) {
    const attempt = await this.attemptRepo.findById(attemptId);
    if (!attempt) throw new ServiceError(404, "Tentative introuvable.");
    if (attempt.studentId !== studentId) throw new ServiceError(403, "Accès refusé à cette tentative.");

    const rows: AnswerRow[] = await this.attemptRepo.findAnswersByAttempt(attemptId);
    const questions = await this.questionRepo.findByExam(attempt.examId);
    const exam = await this.examRepo.findById(attempt.examId);
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const answers: AnswerCorrection[] = rows.map((row) => {
      const question = questions.find((q) => q.id === Number(row.question_id))!;
      const correctChoice = question.choices.find((c) => c.correct)!;
      const choiceId = row.choice_id !== null ? Number(row.choice_id) : null;
      const isCorrect = choiceId !== null && choiceId === correctChoice.id;
      return {
        questionId: question.id,
        questionText: question.text,
        points: question.points,
        choiceId,
        correctChoiceId: correctChoice.id,
        isCorrect,
        choices: question.choices,
      };
    });

    return {
      attemptId: attempt.id,
      examId: attempt.examId,
      examTitle: exam?.title ?? "",
      score: attempt.score,
      totalPoints,
      submittedAt: attempt.submittedAt,
      answers,
    };
  }

  /** GET /api/exams/:id/results */
  async getExamResults(examId: number, examTitle: string, totalPoints: number) {
    const attempts = await this.attemptRepo.findByExam(examId);
    const results = attempts.map((a) => ({
      studentId: a.studentId,
      attemptId: a.id,
      score: a.score,
      submittedAt: a.submittedAt,
      attemptsCount: 1,
    }));
    const average = results.length
      ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
      : 0;
    return { examId, examTitle, totalPoints, average, results };
  }

  private assertWithinWindow(exam: ExamForAttempt) {
    const now = new Date();
    if (now < new Date(exam.startsAt) || now > new Date(exam.endsAt)) {
      throw new ServiceError(403, "Cet examen n'est pas disponible actuellement.");
    }
  }
}