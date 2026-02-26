import type { Request, Response } from "express";
import {
  AuthError,
  authService,
  type AuthTokenPayload,
} from "./auth.service";

type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

export class AuthController {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const username = String(req.body?.username ?? "");
      const password = String(req.body?.password ?? "");
      const result = await authService.register({ username, password });
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: getMessage(error) });
    }
  }

  async login(req: Request, res: Response): Promise<void> {
    try {
      const username = String(req.body?.username ?? "");
      const password = String(req.body?.password ?? "");
      const result = await authService.login({ username, password });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: getMessage(error) });
    }
  }

  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.auth?.sub;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized." });
        return;
      }

      const user = await authService.getCurrentUser(userId);
      res.status(200).json({ user });
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: getMessage(error) });
    }
  }
}

export const authController = new AuthController();
