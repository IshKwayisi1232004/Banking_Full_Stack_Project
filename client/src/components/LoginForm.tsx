import React, {useState } from "react"; 
import type { LoginCredentials } from "../types/auth";

interface LoginFormProps {
    onLogin: (credentials: LoginCredentials) => Promise<void>;
}

const LoginForm: React.FC<LoginFormProps> = ({onLogin}) => {
    const [formData, setFormData] = useState<LoginCredentials>({
        email: "",
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

        if (!formData.email || !formData.password){
            setError("All fields are required.");
            return; 
        }

        try {
            setLoading(true); 
            setError(null);
            await onLogin(formData);
        } catch (err){
            setError("Invalid email or password.");
        } finally {
            setLoading(false);
        }
    };

    return (
    <form onSubmit={handleSubmit} className="login-form">
      <h2>Secure Login</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <div>
        <label>Email</label>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
        />
      </div>

      <div>
        <label>Password</label>
        <input
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
        />
      </div>

      <button type="submit" disabled={loading}>
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  );
};

export default LoginForm;