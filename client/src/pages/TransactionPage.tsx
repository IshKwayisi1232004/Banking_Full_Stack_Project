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
  id: string;
  name: string;
}

const mockAccounts: Account[] = [
  { id: "acc-001", name: "Checking" },
  { id: "acc-002", name: "Savings" },
];


const TransactionsPage = () => {

  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"deposit" | "withdraw">("deposit");
  const [selectedAccount, setSelectedAccount] = useState<string>("acc-001");
  const navigate = useNavigate();

  return (
    <div className="transactions-page">
      <h1>Transaction History</h1>

      <button onClick={() => navigate("/home")}>
        Back to Dashboard
      </button>

      <form
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

        <select
          value={selectedAccount}
          onChange={(e) => setSelectedAccount(e.target.value)}
        >
          {mockAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
        
        <select value={type} onChange={(e) => setType(e.target.value as any)}>
          <option value="deposit">Deposit</option>
          <option value="withdraw">Withdraw</option>
        </select>

        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button type="submit">Submit</button>
      </form>

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
              <td>{transaction.type}</td>
              <td
                style={{
                  color: transaction.type === "debit" ? "red" : "green",
                }}
              >
                ${Math.abs(transaction.amount).toFixed(2)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionsPage;