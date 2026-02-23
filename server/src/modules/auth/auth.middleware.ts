import type { NextFunction, Request, Response } from "express";
import {
  AuthError,
  authService,
  type AuthTokenPayload,
} from "./auth.service";

type AuthenticatedRequest = Request & { auth?: AuthTokenPayload };

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  try {
    const authorization = req.header("authorization") ?? "";
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      res.status(401).json({ message: "Missing Bearer token." });
      return;
    }

    req.auth = authService.verifyToken(token);
    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ message: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : "Unauthorized.";
    res.status(401).json({ message });
  }
}
