import type { LoginCredentials, AuthResponse } from "../types/auth";

export const login = async (
    credentials: LoginCredentials
): Promise<AuthResponse> => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if(credentials.email === "admin@bank.com" && credentials.password === "1234"){
                resolve({
                    token: "fake-jwt-token",
                    userId: "user-001",
                });
            }
            else{
                reject(new Error("Invalid credentials"));
            }
        }, 1000);
    });
};