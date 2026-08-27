// src/Controller/QuestionController.ts
import { Request, Response, NextFunction } from "express";
import { QuestionService } from "../Service/QuestionService";
import { CreateQuestionInput, UpdateQuestionInput } from "../Model/Question";

export const QuestionController = {
  // GET /api/exams/:id/questions -- examId vient de la route parente
  async findAllByExam(req: Request, res: Response, next: NextFunction) {
    try {
      const examId = Number(req.params.id);
      const questions = await QuestionService.findAllByExam(examId);
      res.status(200).json(questions);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const examId = Number(req.params.id);
      const data = req.body as CreateQuestionInput;
      const question = await QuestionService.createQuestion(examId, data);
      res.status(201).json(question);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const questionId = Number(req.params.id);
      const data = req.body as UpdateQuestionInput;
      const question = await QuestionService.updateQuestion(questionId, data);
      res.status(200).json(question);
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const questionId = Number(req.params.id);
      const result = await QuestionService.deleteQuestion(questionId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};