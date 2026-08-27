import { Request, Response } from "express";
import { ResultService } from "../Service/ResultService";

export const ResultController = {
  async getExamResults(req: Request, res: Response) {
    const results = await ResultService.getExamResults(Number(req.params.id));
    res.status(200).json(results);
  },
};