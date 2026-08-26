import { Request, Response, NextFunction } from "express";
import { AuthService } from "../Service/AuthService";

export const AuthController = {
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
};