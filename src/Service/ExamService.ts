import { ExamRepositorie } from "../Repositorie/ExamRepositorie";
import { ApiError } from "../Security/ApiError";
import { Exam, CreateExamInput, UpdateExamInput } from "../Model/Exam";

export const ExamService = {
  
  async findAll(courseId?: number): Promise<Exam[]> {
    return ExamRepositorie.findAll(courseId);
  },

  async findById(id: number): Promise<Exam> {
    const exam = await ExamRepositorie.findById(id);
    if (!exam) {
      throw new ApiError(404, "Examen introuvable.");
    }
    return exam;
  },

   
  async createExam(data: CreateExamInput): Promise<Exam> {
    // 1. Champs obligatoires présents (vérification "gratuite", aucune requête SQL)
    if (
      !data.courseId ||
      !data.title ||
      !data.description ||
      !data.startsAt ||
      !data.endsAt
    ) {
      throw new ApiError(
        400,
        "Le titre, la description, courseId, startsAt et endsAt sont obligatoires."
      );
    }

    // 2. Cohérence des dates (toujours "gratuit", pas d'accès base)
    if (data.endsAt <= data.startsAt) {
      throw new ApiError(
        400,
        "La date de fin doit être postérieure à la date de début."
      );
    }

    // 3. Existence du cours (seule vérification qui coûte une requête SQL,
    // donc placée en dernier)
    const courseExists = await ExamRepositorie.courseExists(data.courseId);
    if (!courseExists) {
      throw new ApiError(400, "Le cours spécifié n'existe pas.");
    }

    // 4. Toutes les règles sont respectées : délégation au Repositorie
    return ExamRepositorie.create(data);
  },

  
  async deleteExam(id: number): Promise<{ id: number; deleted: true }> {
    // 1. L'examen existe-t-il ?
    const exam = await ExamRepositorie.findById(id);
    if (!exam) {
      throw new ApiError(404, "Examen introuvable.");
    }

    // Verifie que , A-t-il déjà des tentatives ? (RG-09 : suppression bloquée)
    const hasAttempts = await ExamRepositorie.hasAttempts(id);
    if (hasAttempts) {
      throw new ApiError(
        409,
        "Impossible de supprimer un examen qui a des tentatives."
      );
    }

    // 3. Toutes les règles sont respectées : suppression effective
    await ExamRepositorie.delete(id);
    return { id, deleted: true };
  },

  
  async updateExam(id: number, data: UpdateExamInput): Promise<Exam> {
    // 1. L'examen existe-t-il ?
    const exam = await ExamRepositorie.findById(id);
    if (!exam) {
      throw new ApiError(404, "Examen introuvable.");
    }

    // 2. Verrouillage : cohérence avec RG-08, choix d'équipe documenté au README
    const hasAttempts = await ExamRepositorie.hasAttempts(id);
    if (hasAttempts) {
      throw new ApiError(
        403,
        "Impossible de modifier un examen qui a déjà des tentatives."
      );
    }

 
    if (data.startsAt !== undefined || data.endsAt !== undefined) {
      const effectiveStartsAt = data.startsAt ?? exam.startsAt;
      const effectiveEndsAt = data.endsAt ?? exam.endsAt;

      if (effectiveEndsAt <= effectiveStartsAt) {
        throw new ApiError(
          400,
          "La date de fin doit être postérieure à la date de début."
        );
      }
    }

    // 4. Si courseId est fourni, il doit correspondre à un cours existant
    if (data.courseId !== undefined) {
      const courseExists = await ExamRepositorie.courseExists(data.courseId);
      if (!courseExists) {
        throw new ApiError(400, "Le cours spécifié n'existe pas.");
      }
    }

    // 5. Toutes les règles sont respectées : délégation au Repositorie
    const updated = await ExamRepositorie.update(id, data);
    // updated ne peut pas être null ici : on a déjà confirmé l'existence à l'étape 1
    return updated as Exam;
  },
};