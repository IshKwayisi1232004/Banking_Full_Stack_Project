import { useNavigate } from "react-router-dom";
import { useState } from "react";

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: "debit" | "credit";
}

const mockTransactions: Transaction[] = [
  {
    id: "1",
    date: "2026-02-18",
    description: "Grocery Store",
    amount: -85.23,
    type: "debit",
  },
  {
    id: "2",
    date: "2026-02-17",
    description: "Paycheck",
    amount: 1500.0,
    type: "credit",
  },
  {
    id: "3",
    date: "2026-02-15",
    description: "Electric Bill",
    amount: -120.5,
    type: "debit",
  },
];

interface Account {
  acc_id: string;
  user_id: string;
  balance: string;
}

const mockAccounts: Account[] = [
  {
    acc_id: "55d134c4-b4a9-4d7b-9b0e-6676a22c167f",
    user_id: "06d4622a-d8d9-4f97-a3c0-ed827b9bbbd2",
    balance: "90.00",
  },
  {
    acc_id: "b353eae0-58d4-4bec-bff8-6c18cf57a039",
    user_id: "57c9dd14-352a-4612-b26f-3ee12bc73d4d",
    balance: "10.00",
  },
];

const TransactionsPage = () => {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [selectedAccount, setSelectedAccount] = useState<string>(
    mockAccounts[0]?.acc_id ?? "",
  );
  const navigate = useNavigate();
  const selectedAccountData = mockAccounts.find(
    (account) => account.acc_id === selectedAccount,
  );

  return (
    <div className="transactions-page">
      <header className="transactions-header">
        <div>
          <p className="transactions-kicker">Operations</p>
          <h1>Transaction History</h1>
          <p className="transactions-subtitle">
            Review your latest account activity.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={() => navigate("/home")}>
          Back to Dashboard
        </button>
      </header>

      <section className="transactions-panel">
        <form
          className="transactions-form"
          onSubmit={async (e) => {
            e.preventDefault();

            const token = localStorage.getItem("token");

            await fetch("http://localhost:3000/api/transactions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                amount: Number(amount),
                type,
              }),
            });

            setAmount("");
          }}
        >
          <h2>Create Transaction</h2>

          <div className="transactions-input-row">
            <label htmlFor="account">Account</label>
            <select
              id="account"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {mockAccounts.map((account) => (
                <option key={account.acc_id} value={account.acc_id}>
                  {account.acc_id}
                </option>
              ))}
            </select>
          </div>

          {selectedAccountData && (
            <div className="transactions-account-meta">
              <p>
                <strong>acc_id:</strong> {selectedAccountData.acc_id}
              </p>
              <p>
                <strong>user_id:</strong> {selectedAccountData.user_id}
              </p>
              <p>
                <strong>balance:</strong> ${selectedAccountData.balance}
              </p>
            </div>
          )}

          <div className="transactions-input-row">
            <label htmlFor="type">Type</label>
            <select
              id="type"
              value={type}
              onChange={(e) =>
                setType(e.target.value as "deposit" | "withdraw")
              }
            >
              <option value="deposit">Deposit</option>
              <option value="withdraw">Withdraw</option>
            </select>
          </div>

          <div className="transactions-input-row">
            <label htmlFor="amount">Amount</label>
            <input
              id="amount"
              type="number"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>

          <button className="btn btn-primary" type="submit">
            Submit
          </button>
        </form>
      </section>

      <section className="transactions-history">
        <div className="transactions-history-head">
          <h3>Recent Transactions</h3>
        </div>

        <div className="transactions-table-wrap">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {mockTransactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td>{transaction.date}</td>
                  <td>{transaction.description}</td>
                  <td>
                    <span
                      className={
                        transaction.type === "debit"
                          ? "chip chip-debit"
                          : "chip chip-credit"
                      }
                    >
                      {transaction.type}
                    </span>
                  </td>
                  <td
                    className={
                      transaction.type === "debit"
                        ? "amount-debit"
                        : "amount-credit"
                    }
                  >
                    {transaction.type === "debit" ? "-" : "+"}$
                    {Math.abs(transaction.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default TransactionsPage;
