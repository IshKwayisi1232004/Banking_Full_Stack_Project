function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readNumberEnv(name: string, fallback: number): number {
  const rawValue = readEnv(name);
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

export const env = {
  authSecret: readEnv("AUTH_SECRET") ?? "dev-auth-secret-change-me",
  authTokenTtlSeconds: readNumberEnv("AUTH_TOKEN_TTL_SECONDS", 86400),
  bcryptSaltRounds: readNumberEnv("BCRYPT_SALT_ROUNDS", 12),
};
