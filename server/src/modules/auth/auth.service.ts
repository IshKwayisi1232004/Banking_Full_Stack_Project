import jwt from "jsonwebtoken";
import { corePool } from "../../db";
import { hashPassword, verifyPassword } from "../../utils/hash";
import { signAuthToken, verifyAuthToken } from "../../utils/jwt";
import type { AuthTokenPayload } from "../../utils/jwt";

interface RegisterInput {
  username: string;
  password: string;
}

interface LoginInput {
  username: string;
  password: string;
}

interface AuthUserProfile {
  id: string;
  username: string;
  accountId: string | null;
  balance: string | null;
}

interface AuthResult {
  token: string;
  user: AuthUserProfile;
}

interface RegisterRow {
  id: string;
  username: string;
}

interface AccountRow {
  acc_id: string;
  balance: string;
}

interface LoginRow {
  id: string;
  username: string;
  psw: string;
  acc_id: string | null;
}

interface ProfileRow {
  id: string;
  username: string;
  acc_id: string | null;
  balance: string | null;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const username = this.normalizeUsername(input.username);
    this.validatePassword(input.password);

    const passwordHash = await hashPassword(input.password);
    const client = await corePool.connect();

    try {
      await client.query("BEGIN");

      const userResult = await client.query<RegisterRow>(
        `
        INSERT INTO users (username, psw)
        VALUES ($1, $2)
        RETURNING id, username
        `,
        [username, passwordHash],
      );

      const user = userResult.rows[0];
      if (!user) {
        throw new AuthError("Failed to create user.", 500);
      }

      const accountResult = await client.query<AccountRow>(
        `
        INSERT INTO accounts (user_id, balance)
        VALUES ($1::uuid, 0.00)
        RETURNING acc_id, balance::text AS balance
        `,
        [user.id],
      );

      const account = accountResult.rows[0];
      if (!account) {
        throw new AuthError("Failed to create account.", 500);
      }

      await client.query("COMMIT");

      const token = signAuthToken({
        sub: user.id,
        username: user.username,
      });

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          accountId: account.acc_id,
          balance: account.balance,
        },
      };
    } catch (error: unknown) {
      await client.query("ROLLBACK").catch(() => undefined);

      if (this.isUniqueViolation(error)) {
        throw new AuthError("Username is already taken.", 409);
      }

      if (error instanceof AuthError) {
        throw error;
      }

      throw new AuthError("Registration failed.", 500);
    } finally {
      client.release();
    }
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const username = this.normalizeUsername(input.username);
    this.validatePassword(input.password);

    const result = await corePool.query<LoginRow>(
      `
      SELECT
        u.id,
        u.username,
        u.psw,
        a.acc_id
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      WHERE u.username = $1
      LIMIT 1
      `,
      [username],
    );

    const user = result.rows[0];
    if (!user || !(await verifyPassword(input.password, user.psw))) {
      throw new AuthError("Invalid username or password.", 401);
    }

    const profile = await this.getUserProfile(user.id);
    if (!profile) {
      throw new AuthError("User profile not found.", 404);
    }

    const token = signAuthToken({
      sub: user.id,
      username: user.username,
    });

    return { token, user: profile };
  }

  async getCurrentUser(userId: string): Promise<AuthUserProfile> {
    const profile = await this.getUserProfile(userId);
    if (!profile) {
      throw new AuthError("User not found.", 404);
    }
    return profile;
  }

  verifyToken(token: string): AuthTokenPayload {
    try {
      return verifyAuthToken(token);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError("Auth token expired.", 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError("Invalid auth token.", 401);
      }
      throw new AuthError("Unauthorized.", 401);
    }
  }

  private async getUserProfile(
    userId: string,
  ): Promise<AuthUserProfile | null> {
    const result = await corePool.query<ProfileRow>(
      `
      SELECT
        u.id,
        u.username,
        a.acc_id,
        a.balance::text AS balance
      FROM users u
      LEFT JOIN accounts a ON a.user_id = u.id
      WHERE u.id = $1::uuid
      LIMIT 1
      `,
      [userId],
    );

    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      accountId: row.acc_id,
      balance: row.balance,
    };
  }

  private normalizeUsername(username: string): string {
    const normalized = String(username ?? "")
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new AuthError("Username is required.", 400);
    }
    if (normalized.length < 3 || normalized.length > 50) {
      throw new AuthError("Username must be between 3 and 50 characters.", 400);
    }
    return normalized;
  }

  private validatePassword(password: string): void {
    const normalized = String(password ?? "");
    if (normalized.length < 6 || normalized.length > 128) {
      throw new AuthError(
        "Password must be between 6 and 128 characters.",
        400,
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!error || typeof error !== "object") {
      return false;
    }
    const code = (error as { code?: string }).code;
    return code === "23505";
  }
}

export const authService = new AuthService();
export type { AuthResult, AuthTokenPayload, AuthUserProfile };
