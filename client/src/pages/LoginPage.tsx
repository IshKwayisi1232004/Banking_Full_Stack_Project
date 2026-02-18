import {useNavigate} from "react-router-dom";
import LoginForm from "../components/LoginForm";
import { login } from "../services/authService";
import type { LoginCredentials } from "../types/auth";

const LoginPage = () => {
    const navigate = useNavigate(); 

    const handleLogin = async (credentials: LoginCredentials) => {
        const response = await login(credentials);

        localStorage.setItem("token", response.token);
        navigate("/home");
    };

    return (
        <div className="login-page">
            <LoginForm onLogin={handleLogin}/>
        </div>
    );
};

export default LoginPage;