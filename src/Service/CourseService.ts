import { CourseRepositorie } from "../Repositorie/CourseRepositorie";
import { Course } from "../Model/Course";
import { ApiError } from "../Security/ApiError";

export const CourseService = {
  async getAll(): Promise<Course[]> {
    return CourseRepositorie.findAll();
  },

  async create(data: { code: string; name: string; description: string }): Promise<Course> {
    if (!data.code || !data.name) {
      throw new ApiError(400, "Le code et le nom du cours sont requis.");
    }

    const existing = await CourseRepositorie.findByCode(data.code);
    if (existing) {
      throw new ApiError(400, "Ce code de cours est déjà utilisé.");
    }

    return CourseRepositorie.create({
      code: data.code,
      name: data.name,
      description: data.description ?? "",
    });
  },

  async update(
    id: number,
    data: Partial<{ code: string; name: string; description: string }>
  ): Promise<Course> {
    const course = await CourseRepositorie.findById(id);
    if (!course) {
      throw new ApiError(404, "Cours introuvable.");
    }

    if (data.code && data.code !== course.code) {
      const existing = await CourseRepositorie.findByCode(data.code);
      if (existing) {
        throw new ApiError(400, "Ce code de cours est déjà utilisé.");
      }
    }

    const updated = await CourseRepositorie.update(id, data);
    return updated!;
  },

  async delete(id: number): Promise<{ id: number; deleted: true }> {
    const course = await CourseRepositorie.findById(id);
    if (!course) {
      throw new ApiError(404, "Cours introuvable.");
    }

    const hasExams = await CourseRepositorie.hasExams(id);
    if (hasExams) {
      throw new ApiError(
        409,
        "Impossible de supprimer un cours qui possède des examens."
      );
    }

    await CourseRepositorie.delete(id);
    return { id, deleted: true };
  },
};