import { AttemptService } from "./AttemptService";

export const ResultService = {
  /** GET /api/exams/:id/results — vue admin (moyenne, tentatives) */
  async getExamResults(examId: number) {
    return AttemptService.getExamResults(examId);
  },
};