import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginForm from "../components/LoginForm";
import { getMe, login, register } from "../services/authService";
import type { AuthCredentials, AuthMode } from "../types/auth";

const LoginPage = () => {
    const navigate = useNavigate();
    const [checkingSession, setCheckingSession] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem("token");
        if (!token) {
            setCheckingSession(false);
            return;
        }

        let cancelled = false;

        void getMe(token)
            .then(() => {
                if (!cancelled) {
                    navigate("/home", { replace: true });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    localStorage.removeItem("token");
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setCheckingSession(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [navigate]);

    const handleAuth = async (credentials: AuthCredentials, mode: AuthMode) => {
        const response =
            mode === "login"
                ? await login(credentials)
                : await register(credentials);

        localStorage.setItem("token", response.token);
        navigate("/home", { replace: true });
    };

    if (checkingSession) {
        return <div className="login-page">Checking session...</div>;
    }

    return (
        <div className="login-page">
            <LoginForm onSubmit={handleAuth} />
        </div>
    );
};

export default LoginPage;
