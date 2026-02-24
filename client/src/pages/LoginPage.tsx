import {useNavigate} from "react-router-dom";
import LoginForm from "../components/LoginForm";
import { login, register } from "../services/authService";
import type { AuthCredentials, AuthMode } from "../types/auth";

const LoginPage = () => {
    const navigate = useNavigate(); 

    const handleAuth = async (credentials: AuthCredentials, mode: AuthMode) => {
        const response =
            mode === "login"
                ? await login(credentials)
                : await register(credentials);

        localStorage.setItem("token", response.token);
        navigate("/home");
    };

    return (
        <div className="login-page">
            <LoginForm onSubmit={handleAuth}/>
        </div>
    );
};

export default LoginPage;
