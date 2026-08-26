// src/Controller/MyExamController.ts
import { Request, Response, NextFunction } from "express";
import { AttemptService } from "../Service/AttemptService";

export const MyExamController = {
  /** GET /api/my/exams */
  async listAvailable(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user!.id;
      const exams = await AttemptService.getAvailableExams(studentId);
      res.status(200).json(exams);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/my/exams/:id */
  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user!.id;
      const examId = Number(req.params.id);
      const exam = await AttemptService.getExamForStudent(studentId, examId);
      res.status(200).json(exam);
    } catch (err) {
      next(err);
    }
  },

  /** POST /api/my/exams/:id/submit */
  async submit(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user!.id;
      const examId = Number(req.params.id);
      const result = await AttemptService.submitExam(studentId, examId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/my/results */
  async listMyResults(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user!.id;
      const results = await AttemptService.getMyResults(studentId);
      res.status(200).json(results);
    } catch (err) {
      next(err);
    }
  },

  /** GET /api/my/results/:attemptId */
  async getMyResultDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const studentId = req.user!.id;
      const attemptId = Number(req.params.attemptId);
      const detail = await AttemptService.getMyResultDetail(studentId, attemptId);
      res.status(200).json(detail);
    } catch (err) {
      next(err);
    }
  },
};