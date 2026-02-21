import { useNavigate } from "react-router-dom";

const HomePage = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token");
        navigate("/");
    };

    return (
        <div className="home-page">
            <h1>Welcome to our BankingApp</h1>

            <section className="account-summary">
                <h2>Account Summary</h2>
                <div className="account-card">
                <p>Checking Account</p>
                <h3>$5,240.32</h3>
                </div>

                <div className="account-card">
                <p>Savings Account</p>
                <h3>$12,980.11</h3>
                </div>
            </section>

            <section className="quick-actions">
                <button onClick={() => navigate("/transactions")}>
                View Transactions
                </button>

                <button onClick={handleLogout}>
                Logout
                </button>
            </section>
        </div>
    )
}

export default HomePage;