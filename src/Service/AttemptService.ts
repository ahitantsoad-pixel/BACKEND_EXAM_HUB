// src/Service/AttemptService.ts
import { pool } from "../config/db";
import { ApiError } from "../Security/ApiError";
import { AttemptRepositorie } from "../Repositorie/AttemptRepositorie";
import { ExamRepositorie } from "../Repositorie/ExamRepositorie";
import { QuestionRepositorie } from "../Repositorie/QuestionRepositorie";
import { Attempt } from "../Model/Attempt";
import { SubmittedAnswer, AnswerCorrection, AnswerRow } from "../Model/Answer";
import { Exam } from "../Model/Exam";
import { QuestionAdmin } from "../Model/Question";

const attemptRepo = new AttemptRepositorie(pool);

export const AttemptService = {
  /** GET /api/my/exams — examens dispo pour l'étudiant (fenêtre ouverte + pas déjà passés) */
  async getAvailableExams(studentId: number): Promise<Exam[]> {
    const allExams = await ExamRepositorie.findAll();
    const now = new Date();
    const available: Exam[] = [];
    for (const exam of allExams) {
      const inWindow = exam.startsAt <= now && now <= exam.endsAt;
      if (!inWindow) continue;
      const already = await attemptRepo.existsForStudentAndExam(studentId, exam.id);
      if (!already) available.push(exam);
    }
    return available;
  },

  /** GET /api/my/exams/:id — détail pour passage, sans le champ "correct" (RG-07) */
  async getExamForStudent(studentId: number, examId: number) {
    const exam = await ExamRepositorie.findById(examId);
    if (!exam) throw new ApiError(404, "Examen introuvable.");

    this.assertWithinWindow(exam);

    const already = await attemptRepo.existsForStudentAndExam(studentId, examId);
    if (already) throw new ApiError(409, "Vous avez déjà passé cet examen.");

    const questions = await QuestionRepositorie.findByExamId(examId);
    return {
      id: exam.id,
      title: exam.title,
      description: exam.description,
      startsAt: exam.startsAt,
      endsAt: exam.endsAt,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text,
        points: q.points,
        choices: q.choices.map((c) => ({ id: c.id, text: c.text })), // jamais "correct" (RG-07)
      })),
    };
  },

  /** POST /api/my/exams/:id/submit — RG-02, RG-03, RG-05, RG-06, RG-12 */
  async submitExam(studentId: number, examId: number, body: { answers: SubmittedAnswer[] }) {
    const exam = await ExamRepositorie.findById(examId);
    if (!exam) throw new ApiError(404, "Examen introuvable.");

    this.assertWithinWindow(exam); // RG-03, revérifié à la soumission

    const already = await attemptRepo.existsForStudentAndExam(studentId, examId);
    if (already) throw new ApiError(409, "Vous avez déjà passé cet examen."); // RG-02

    const questions: QuestionAdmin[] = await QuestionRepositorie.findByExamId(examId);
    if (questions.length === 0) throw new ApiError(400, "Cet examen n'a aucune question.");

    const questionIds = new Set(questions.map((q) => q.id));
    for (const a of body.answers) {
      if (!questionIds.has(a.questionId)) {
        throw new ApiError(400, "Réponse invalide pour une ou plusieurs questions.");
      }
      if (a.choiceId !== null) {
        const question = questions.find((q) => q.id === a.questionId)!;
        const validChoice = question.choices.some((c) => c.id === a.choiceId);
        if (!validChoice) {
          throw new ApiError(400, "Réponse invalide pour une ou plusieurs questions.");
        }
      }
    }

    // RG-06 : calcul du score UNIQUEMENT côté serveur, à partir des vraies bonnes réponses
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

      answersToPersist.push({ questionId: question.id, choiceId });
    }

    const attempt: Attempt = await attemptRepo.createAttemptWithAnswers({
      studentId,
      examId,
      score,
      answers: answersToPersist,
    });

    return {
      attemptId: attempt.id,
      score: attempt.score,
      totalPoints,
      submittedAt: attempt.submittedAt,
      answers: answerCorrections, // RG-12
    };
  },

  /** GET /api/my/results — historique de l'étudiant connecté */
  async getMyResults(studentId: number) {
    const attempts = await attemptRepo.findByStudent(studentId);
    const results = [];
    for (const attempt of attempts) {
      const exam = await ExamRepositorie.findById(attempt.examId);
      const questions = await QuestionRepositorie.findByExamId(attempt.examId);
      const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);
      results.push({
        attemptId: attempt.id,
        examId: attempt.examId,
        examTitle: exam?.title ?? "",
        score: attempt.score,
        totalPoints,
        submittedAt: attempt.submittedAt,
      });
    }
    return results;
  },

  /** GET /api/my/results/:attemptId — détail/correction d'une tentative passée */
  async getMyResultDetail(studentId: number, attemptId: number) {
    const attempt = await attemptRepo.findById(attemptId);
    if (!attempt) throw new ApiError(404, "Tentative introuvable.");
    if (attempt.studentId !== studentId) throw new ApiError(403, "Accès refusé à cette tentative.");

    const rows: AnswerRow[] = await attemptRepo.findAnswersByAttempt(attemptId);
    const questions = await QuestionRepositorie.findByExamId(attempt.examId);
    const exam = await ExamRepositorie.findById(attempt.examId);
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
  },

  /** GET /api/exams/:id/results — vue admin (moyenne, tentatives) */
  async getExamResults(examId: number) {
    const exam = await ExamRepositorie.findById(examId);
    if (!exam) throw new ApiError(404, "Examen introuvable.");
    const questions = await QuestionRepositorie.findByExamId(examId);
    const totalPoints = questions.reduce((sum, q) => sum + q.points, 0);

    const attempts = await attemptRepo.findByExam(examId);
    const results = attempts.map((a) => ({
      studentId: a.studentId,
      attemptId: a.id,
      score: a.score,
      submittedAt: a.submittedAt,
      attemptsCount: 1, // toujours 1 vu RG-02, gardé pour robustesse
    }));
    const average = results.length
      ? Math.round((results.reduce((s, r) => s + r.score, 0) / results.length) * 10) / 10
      : 0;
    return { examId, examTitle: exam.title, totalPoints, average, results };
  },

  // -------- Helpers --------

  assertWithinWindow(exam: Exam) {
    const now = new Date();
    if (now < exam.startsAt || now > exam.endsAt) {
      throw new ApiError(403, "Cet examen n'est pas disponible actuellement.");
    }
  },
};