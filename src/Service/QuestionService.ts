import { QuestionRepositorie } from "../Repositorie/QuestionRepositorie";
import { ExamRepositorie } from "../Repositorie/ExamRepositorie";
import { ApiError } from "../Security/ApiError";
import { QuestionAdmin, CreateQuestionInput, UpdateQuestionInput } from "../Model/Question";

export const QuestionService = {

  async findAllByExam(examId: number): Promise<QuestionAdmin[]> {
    // Vue admin : pas de restriction RG-07 ici, correct est inclus par construction
    // (QuestionRepositorie.findByExamId renvoie toujours QuestionAdmin).
    const examExists = await ExamRepositorie.findById(examId);
    if (!examExists) {
      throw new ApiError(404, "Examen introuvable.");
    }
    return QuestionRepositorie.findByExamId(examId);
  },

  async findById(id: number): Promise<QuestionAdmin> {
    const question = await QuestionRepositorie.findById(id);
    if (!question) {
      throw new ApiError(404, "Question introuvable.");
    }
    return question;
  },

  /**
   * Valide RG-04 sur un tableau de choix : entre 2 et 6, exactement 1 correct.
   */
  validateChoices(choices: CreateQuestionInput["choices"] | undefined): void {
    if (!choices || choices.length < 2 || choices.length > 6) {
      throw new ApiError(400, "Une question doit avoir entre 2 et 6 choix.");
    }
    const correctCount = choices.filter((c) => c.correct).length;
    if (correctCount !== 1) {
      throw new ApiError(400, "Une question doit avoir exactement un choix correct.");
    }
  },

  async createQuestion(examId: number, data: CreateQuestionInput): Promise<QuestionAdmin> {
    // 1. Champs obligatoires présents (gratuit)
    if (!data.text || data.points === undefined || data.points === null) {
      throw new ApiError(400, "Le texte et les points sont obligatoires.");
    }

    // 2. RG-04 sur les choix (gratuit, pure logique sur le body)
    this.validateChoices(data.choices);

    // 3. L'examen existe-t-il ? (coûte une requête SQL)
    const exam = await ExamRepositorie.findById(examId);
    if (!exam) {
      throw new ApiError(404, "Examen introuvable.");
    }

    // 4. Verrouillage RG-08 étendu : pas de nouvelle question si l'examen a
    // déjà des tentatives (décision d'équipe à documenter au README --
    // RG-08 ne mentionne explicitement que modification/suppression, mais
    // on l'étend à la création pour garder des examens comparables entre
    // étudiants).
    const hasAttempts = await ExamRepositorie.hasAttempts(examId);
    if (hasAttempts) {
      throw new ApiError(403, "Impossible d'ajouter une question à un examen qui a déjà des tentatives.");
    }

    // 5. Toutes les règles sont respectées : délégation au Repositorie
    return QuestionRepositorie.create(examId, data);
  },

  async updateQuestion(id: number, data: UpdateQuestionInput): Promise<QuestionAdmin> {
    // 1. La question existe-t-elle ?
    const question = await QuestionRepositorie.findById(id);
    if (!question) {
      throw new ApiError(404, "Question introuvable.");
    }

    // 2. Verrouillage RG-08 : on retrouve l'examen via la question,
    // puis on vérifie ses tentatives.
    const hasAttempts = await ExamRepositorie.hasAttempts(question.examId);
    if (hasAttempts) {
      throw new ApiError(403, "Impossible de modifier une question dont l'examen a déjà des tentatives.");
    }

    if (data.choices !== undefined) {
      this.validateChoices(data.choices);
    }

    // 4. Toutes les règles sont respectées : délégation au Repositorie
    const updated = await QuestionRepositorie.update(id, data);
    // updated ne peut pas être null ici : existence déjà confirmée à l'étape 1
    return updated as QuestionAdmin;
  },

  async deleteQuestion(id: number): Promise<{ id: number; deleted: true }> {
    // 1. La question existe-t-elle ?
    const question = await QuestionRepositorie.findById(id);
    if (!question) {
      throw new ApiError(404, "Question introuvable.");
    }

    // 2. Verrouillage RG-08
    const hasAttempts = await ExamRepositorie.hasAttempts(question.examId);
    if (hasAttempts) {
      throw new ApiError(403, "Impossible de supprimer une question dont l'examen a déjà des tentatives.");
    }

    // 3. Suppression effective
    await QuestionRepositorie.delete(id);
    return { id, deleted: true };
  },
};