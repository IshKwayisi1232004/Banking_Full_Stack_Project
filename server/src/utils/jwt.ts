import jwt from "jsonwebtoken";
import { env } from "../config/env";

interface AuthTokenPayload {
  sub: string;
  username: string;
  iat: number;
  exp: number;
}

type TokenInput = {
  sub: string;
  username: string;
};

export function signAuthToken(payload: TokenInput): string {
  return jwt.sign(payload, env.authSecret, {
    algorithm: "HS256",
    expiresIn: env.authTokenTtlSeconds,
  });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.authSecret, {
    algorithms: ["HS256"],
  });

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid auth token payload.");
  }

  const payload = decoded as Partial<AuthTokenPayload>;
  if (!payload.sub || !payload.username || !payload.iat || !payload.exp) {
    throw new Error("Invalid auth token payload.");
  }

  return {
    sub: payload.sub,
    username: payload.username,
    iat: payload.iat,
    exp: payload.exp,
  };
}

export type { AuthTokenPayload };
