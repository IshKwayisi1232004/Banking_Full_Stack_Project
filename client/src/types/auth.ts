export interface AuthCredentials {
  username: string;
  password: string;
}

export interface AuthUser {
  id: string;
  username: string;
  accountId: string | null;
  balance: string | null;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface AuthMeResponse {
  user: AuthUser;
}

export type AuthMode = "login" | "register";
