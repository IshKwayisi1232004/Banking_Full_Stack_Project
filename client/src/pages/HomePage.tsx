import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getMe } from "../services/authService";
import type { AuthUser } from "../types/auth";

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    void getMe(token)
      .then((response) => {
        setUser(response.user);
        setError(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load user profile.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-kicker">Banking Dashboard</p>
          <h1>Welcome back</h1>
          <p className="home-subtitle">Track balances and control your money flow.</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {loading && <p className="home-state">Loading profile...</p>}
      {error && <p className="home-state home-state-error">{error}</p>}

      <section className="home-metrics">
        <article className="metric-card metric-card-primary">
          <p>balance</p>
          <h2>{user?.balance ? `$${user.balance}` : "$0.00"}</h2>
          <span>From /auth/me</span>
        </article>
        <article className="metric-card">
          <p>acc_id</p>
          <h2>{user?.accountId ?? "No account"}</h2>
          <span>Primary account</span>
        </article>
        <article className="metric-card">
          <p>user_id</p>
          <h2>{user?.id ?? "Unknown user"}</h2>
          <span>Authenticated profile</span>
        </article>
      </section>

      <section className="home-actions">
        <button className="btn btn-primary" onClick={() => navigate("/transactions")}>
          View Transactions
        </button>
        <button className="btn btn-ghost">Transfer Money</button>
        <button className="btn btn-ghost">Top Up Account</button>
      </section>

      <section className="home-history">
        <div className="history-head">
          <h3>Recent Activity</h3>
          <button className="btn btn-link" onClick={() => navigate("/transactions")}>
            Open Full History
          </button>
        </div>
        <div className="history-list">
          <div className="history-row">
            <span>2026-02-18</span>
            <span>Grocery Store</span>
            <span className="chip chip-debit">debit</span>
            <strong className="amount-debit">-$85.23</strong>
          </div>
          <div className="history-row">
            <span>2026-02-17</span>
            <span>Paycheck</span>
            <span className="chip chip-credit">credit</span>
            <strong className="amount-credit">+$1500.00</strong>
          </div>
          <div className="history-row">
            <span>2026-02-15</span>
            <span>Electric Bill</span>
            <span className="chip chip-debit">debit</span>
            <strong className="amount-debit">-$120.50</strong>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
