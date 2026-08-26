import { Request, Response, NextFunction } from "express";
import { ExamService } from "../Service/ExamService";
import { CreateExamInput, UpdateExamInput } from "../Model/Exam";
import { ApiError } from "../Security/ApiError";

 
function parseExamDates<T extends { startsAt?: unknown; endsAt?: unknown }>(
  body: T
): T & { startsAt?: Date; endsAt?: Date } {
  const parsed = { ...body } as T & { startsAt?: Date; endsAt?: Date };

  if (body.startsAt !== undefined) {
    const d = new Date(body.startsAt as string);
    if (isNaN(d.getTime())) {
      throw new ApiError(400, "startsAt n'est pas une date valide.");
    }
    parsed.startsAt = d;
  }

  if (body.endsAt !== undefined) {
    const d = new Date(body.endsAt as string);
    if (isNaN(d.getTime())) {
      throw new ApiError(400, "endsAt n'est pas une date valide.");
    }
    parsed.endsAt = d;
  }

  return parsed;
}

export const ExamController = {
   

  async findAll(req: Request, res: Response) {
    const courseId = req.query.courseId ? Number(req.query.courseId) : undefined;
    const exams = await ExamService.findAll(courseId);
    res.status(200).json(exams);
  },

  async findById(req: Request, res: Response) {
    const exam = await ExamService.findById(Number(req.params.id));
    res.status(200).json(exam);
  },

  async create(req: Request, res: Response) {
    const data = parseExamDates(req.body) as CreateExamInput;
    const exam = await ExamService.createExam(data);
    res.status(201).json(exam);
  },

  async update(req: Request, res: Response) {
    const data = parseExamDates(req.body) as UpdateExamInput;
    const exam = await ExamService.updateExam(Number(req.params.id), data);
    res.status(200).json(exam);
  },

  async remove(req: Request, res: Response) {
    const result = await ExamService.deleteExam(Number(req.params.id));
    res.status(200).json(result);
  },
};