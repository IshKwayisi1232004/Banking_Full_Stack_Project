import bcrypt from "bcrypt";
import { env } from "../config/env";

export async function hashPassword(rawPassword: string): Promise<string> {
  return bcrypt.hash(rawPassword, env.bcryptSaltRounds);
}

export async function verifyPassword(
  rawPassword: string,
  passwordHash: string,
): Promise<boolean> {
  return bcrypt.compare(rawPassword, passwordHash);
}
