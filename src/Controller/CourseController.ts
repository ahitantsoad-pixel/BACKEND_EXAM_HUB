import { Request, Response, NextFunction } from "express";
import { CourseService } from "../Service/CourseService";

export const CourseController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const courses = await CourseService.getAll();
      res.status(200).json(courses);
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const course = await CourseService.create(req.body);
      res.status(201).json(course);
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const course = await CourseService.update(id, req.body);
      res.status(200).json(course);
    } catch (err) {
      next(err);
    }
  },

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const result = await CourseService.delete(id);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};