import { Request, Response, NextFunction } from "express";
import { StudentService } from "../Service/StudentService";

export const StudentController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const students = await StudentService.getAll();
      res.status(200).json(students);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const student = await StudentService.create(req.body);
      res.status(201).json(student);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const student = await StudentService.update(id, req.body);
      res.status(200).json(student);
    } catch (err) {
      next(err);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const result = await StudentService.resetPassword(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },

  async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const student = await StudentService.deactivate(id);
      res.status(200).json(student);
    } catch (err) {
      next(err);
    }
  },
};