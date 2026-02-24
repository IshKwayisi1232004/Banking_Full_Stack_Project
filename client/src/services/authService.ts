import type { AuthCredentials, AuthMeResponse, AuthResponse } from "../types/auth";

const API_BASE_URL = "http://localhost:5001";

async function requestAuth(
  path: "/auth/login" | "/auth/register",
  credentials: AuthCredentials,
): Promise<AuthResponse> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(credentials),
  });

  const payload = (await response.json()) as Partial<AuthResponse> & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Authentication request failed.");
  }

  if (!payload.token || !payload.user) {
    throw new Error("Invalid auth response.");
  }

  return payload as AuthResponse;
}

export function login(credentials: AuthCredentials): Promise<AuthResponse> {
  return requestAuth("/auth/login", credentials);
}

export function register(credentials: AuthCredentials): Promise<AuthResponse> {
  return requestAuth("/auth/register", credentials);
}

export async function getMe(token: string): Promise<AuthMeResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = (await response.json()) as Partial<AuthMeResponse> & {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "Could not fetch current user.");
  }

  if (!payload.user) {
    throw new Error("Invalid current user response.");
  }

  return payload as AuthMeResponse;
}
