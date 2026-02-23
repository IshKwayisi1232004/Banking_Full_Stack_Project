import { useNavigate } from "react-router-dom";

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

const TransactionsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="transactions-page">
      <h1>Transaction History</h1>

      <button onClick={() => navigate("/home")}>
        Back to Dashboard
      </button>

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