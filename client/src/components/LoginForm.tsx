import React, { useState } from "react";
import type { AuthCredentials, AuthMode } from "../types/auth";

interface LoginFormProps {
  onSubmit: (credentials: AuthCredentials, mode: AuthMode) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({ onSubmit }) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [formData, setFormData] = useState<AuthCredentials>({
    username: "",
    password: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.username || !formData.password) {
      setError("All fields are required.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onSubmit(formData, mode);
    } catch (err: object | unknown) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>{mode === "login" ? "Logging" : "Registering"}</h2>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div className="login-row">
        <label>Username</label>
        <input
          type="text"
          name="username"
          value={formData.username}
          onChange={handleChange}
        />
      </div>

      <div className="login-row">
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading
          ? mode === "login"
            ? "Logging in..."
            : "Creating account..."
          : mode === "login"
            ? "Login"
            : "Register"}
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={() =>
          setMode((prev) => (prev === "login" ? "register" : "login"))
        }
      >
        {mode === "login" ? "Register" : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;
