import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createAccount, getAccountsOverview } from "../services/accountsService";
import type { AccountInfo, OverviewUser } from "../types/account";

const HomePage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<OverviewUser | null>(null);
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshOverview = async (token: string): Promise<void> => {
    const response = await getAccountsOverview(token);
    setUser(response.user);
    setAccounts(response.accounts);
  };

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

    void refreshOverview(token)
      .then(() => {
        setError(null);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : "Failed to load account overview.";
        setError(message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [navigate]);

  const handleAddAccount = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    setCreatingAccount(true);
    setError(null);
    try {
      await createAccount(token, 0);
      await refreshOverview(token);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create account.";
      setError(message);
    } finally {
      setCreatingAccount(false);
    }
  };

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-kicker">Banking Dashboard</p>
          <h1>Welcome back</h1>
          <p className="home-subtitle">Track balances and control your money flow.</p>
          <p className="home-subtitle">
            user_id: <strong>{user?.id ?? "unknown"}</strong>
          </p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>
          Logout
        </button>
      </header>

      {loading && <p className="home-state">Loading profile...</p>}
      {error && <p className="home-state home-state-error">{error}</p>}

      <section className="home-metrics">
        <article className="metric-card metric-card-primary">
          <p>username</p>
          <h2>{user?.username ?? "unknown"}</h2>
          <span>Authenticated user</span>
        </article>
        <article className="metric-card">
          <p>accounts</p>
          <h2>{accounts.length}</h2>
          <span>Total linked accounts</span>
        </article>
      </section>

      <section className="home-actions">
        <button
          className="btn btn-primary"
          onClick={handleAddAccount}
          disabled={creatingAccount}
        >
          {creatingAccount ? "Creating..." : "Add Account"}
        </button>
      </section>

      <section className="home-history">
        <div className="history-head">
          <h3>Your Accounts</h3>
        </div>
        <div className="history-list">
          {accounts.map((account) => (
            <button
              key={account.acc_id}
              className="history-row account-row-button"
              onClick={() =>
                navigate(`/transactions?accountId=${account.acc_id}`)
              }
              type="button"
            >
              <span>{account.acc_id}</span>
              <span>{account.user_id}</span>
              <strong className="amount-positive">${account.balance}</strong>
            </button>
          ))}
          {accounts.length === 0 && !loading && (
            <p className="home-state">No accounts found for this user.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default HomePage;
