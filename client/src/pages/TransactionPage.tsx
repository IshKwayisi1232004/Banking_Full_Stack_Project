import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  adjustAccountBalance,
  getTransactionStatus,
  getAccountTransactions,
  getAccountsOverview,
  getRecipientAccounts,
  makeAccountTransfer,
  recoverTransaction,
  simulateTransferWithFailPoint,
} from "../services/accountsService";
import type {
  AccountInfo,
  AccountTransaction,
  FailPoint,
  OverviewUser,
  SimulatedTransferResponse,
} from "../types/account";

type ModalKind = "none" | "adjust" | "transfer";
type AdjustMode = "deposit" | "withdraw";
type SimulatedTransferView = {
  success: boolean;
  transactionId: string;
  phase: string;
  failPointTriggered?: string;
  errorMessage?: string;
};

const FAIL_POINT_OPTIONS: FailPoint[] = [
  "BEFORE_CORE_PREPARE",
  "BEFORE_LEDGER_PREPARE",
  "BEFORE_COMMIT",
  "AFTER_CORE_COMMIT",
  "AFTER_LEDGER_COMMIT",
];

function mapSimulationView(
  simulation: SimulatedTransferResponse,
): SimulatedTransferView {
  return {
    success: simulation.success,
    transactionId: simulation.transactionId,
    phase: simulation.state.phase,
    failPointTriggered: simulation.state.failPointTriggered,
    errorMessage: simulation.state.errorMessage,
  };
}

const TransactionsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedAccountId = searchParams.get("accountId");
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [transactions, setTransactions] = useState<AccountTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeModal, setActiveModal] = useState<ModalKind>("none");
  const [adjustMode, setAdjustMode] = useState<AdjustMode>("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferRecipientUsername, setTransferRecipientUsername] = useState("");
  const [transferRecipientUser, setTransferRecipientUser] =
    useState<OverviewUser | null>(null);
  const [transferRecipientAccounts, setTransferRecipientAccounts] = useState<
    AccountInfo[]
  >([]);
  const [transferTargetAccount, setTransferTargetAccount] = useState("");
  const [transferFailPoint, setTransferFailPoint] = useState<FailPoint | "">("");
  const [transferSubmittedOnce, setTransferSubmittedOnce] = useState(false);
  const [simulatedTransfer, setSimulatedTransfer] =
    useState<SimulatedTransferView | null>(null);
  const [simulationMessage, setSimulationMessage] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);
  const isRecoveryRequired = simulatedTransfer?.phase === "IN_DOUBT";

  const selectedAccountData = useMemo(
    () => accounts.find((account) => account.acc_id === selectedAccount) ?? null,
    [accounts, selectedAccount],
  );

  const loadOverviewAndTransactions = useCallback(
    async (token: string, preferredAccountId?: string): Promise<void> => {
      const overview = await getAccountsOverview(token);
      setAccounts(overview.accounts);

      const fallbackAccountId = overview.accounts[0]?.acc_id ?? "";
      const nextAccountId =
        (overview.accounts.find((item) => item.acc_id === requestedAccountId)?.acc_id ??
          preferredAccountId) ||
        fallbackAccountId;

      if (!nextAccountId) {
        setSelectedAccount("");
        setTransactions([]);
        return;
      }

      setSelectedAccount(nextAccountId);
      if (requestedAccountId !== nextAccountId) {
        setSearchParams({ accountId: nextAccountId }, { replace: true });
      }

      const txResponse = await getAccountTransactions(token, nextAccountId);
      setTransactions(txResponse.transactions);
    },
    [requestedAccountId, setSearchParams],
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    queueMicrotask(() => {
      void loadOverviewAndTransactions(token)
        .then(() => {
          if (!cancelled) {
            setError(null);
          }
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            const message =
              err instanceof Error ? err.message : "Failed to load transactions.";
            setError(message);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loadOverviewAndTransactions, navigate]);

  const handleAccountChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const accountId = event.target.value;
    setSelectedAccount(accountId);
    setSearchParams({ accountId });

    const token = localStorage.getItem("token");
    if (!token || !accountId) {
      return;
    }

    setError(null);
    try {
      const txResponse = await getAccountTransactions(token, accountId);
      setTransactions(txResponse.transactions);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load transactions.";
      setError(message);
    }
  };

  const openAdjustModal = () => {
    setAdjustMode("deposit");
    setAdjustAmount("");
    setActiveModal("adjust");
    setError(null);
  };

  const openTransferModal = () => {
    setTransferAmount("");
    setTransferRecipientUsername("");
    setTransferRecipientUser(null);
    setTransferRecipientAccounts([]);
    setTransferTargetAccount("");
    setTransferFailPoint("");
    setTransferSubmittedOnce(false);
    setSimulatedTransfer(null);
    setSimulationMessage(null);
    setActiveModal("transfer");
    setError(null);
  };

  const closeModal = () => {
    if (activeModal === "transfer" && isRecoveryRequired) {
      setSimulationMessage(
        "Recovery is required before closing this dialog or leaving the page.",
      );
      return;
    }
    setActiveModal("none");
    setSubmitting(false);
  };

  const handleLookupRecipientAccounts = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Missing auth token.");
      return;
    }

    const normalizedUsername = transferRecipientUsername.trim().toLowerCase();
    if (!normalizedUsername) {
      setError("Enter recipient username.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await getRecipientAccounts(token, normalizedUsername);
      const accountsForTransfer = response.accounts.filter(
        (account) => account.acc_id !== selectedAccount,
      );

      setTransferRecipientUser(response.user);
      setTransferRecipientAccounts(accountsForTransfer);
      setTransferTargetAccount(accountsForTransfer[0]?.acc_id ?? "");

      if (accountsForTransfer.length === 0) {
        setError("Recipient has no available account for this transfer.");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch recipient accounts.";
      setError(message);
      setTransferRecipientUser(null);
      setTransferRecipientAccounts([]);
      setTransferTargetAccount("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAdjust = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = localStorage.getItem("token");
    if (!token || !selectedAccount) {
      setError("Missing auth token or selected account.");
      return;
    }

    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a positive amount.");
      return;
    }

    const delta = adjustMode === "deposit" ? amount : -amount;

    setSubmitting(true);
    setError(null);
    try {
      await adjustAccountBalance(token, selectedAccount, delta);
      await loadOverviewAndTransactions(token, selectedAccount);
      closeModal();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to adjust account balance.";
      setError(message);
      setSubmitting(false);
    }
  };

  const handleSubmitTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (transferSubmittedOnce) {
      return;
    }

    const token = localStorage.getItem("token");
    if (!token || !selectedAccount) {
      setError("Missing auth token or selected account.");
      return;
    }

    if (!transferTargetAccount) {
      setError("Choose destination account id.");
      return;
    }

    const amount = Number(transferAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Transfer amount must be a positive number.");
      return;
    }

    const sourceUserId = selectedAccountData?.user_id;
    const recipientUserId = transferRecipientUser?.id;
    if (transferFailPoint && (!sourceUserId || !recipientUserId)) {
      setError("Choose recipient user and account before simulated transfer.");
      return;
    }

    setSubmitting(true);
    setTransferSubmittedOnce(true);
    setError(null);
    setSimulationMessage(null);
    try {
      if (transferFailPoint && sourceUserId && recipientUserId) {
        const simulation = await simulateTransferWithFailPoint(token, {
          senderId: sourceUserId,
          receiverId: recipientUserId,
          senderAccountId: selectedAccount,
          receiverAccountId: transferTargetAccount,
          amount,
          failPoint: transferFailPoint,
        });
        setSimulatedTransfer(mapSimulationView(simulation));
        setSimulationMessage("Simulation completed. Check the phase below.");
      } else {
        await makeAccountTransfer(token, selectedAccount, transferTargetAccount, amount);
        closeModal();
      }

      await loadOverviewAndTransactions(token, selectedAccount);
      setSubmitting(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to execute transfer.";
      setError(message);
      setSubmitting(false);
    }
  };

  const handleRefreshSimulationStatus = async () => {
    const token = localStorage.getItem("token");
    if (!token || !simulatedTransfer) {
      return;
    }

    setRecovering(true);
    setError(null);
    setSimulationMessage(null);
    try {
      const status = await getTransactionStatus(token, simulatedTransfer.transactionId);
      if (!status.found) {
        setSimulationMessage("Transaction not found.");
        return;
      }

      setSimulatedTransfer((previous) => {
        if (!previous) {
          return null;
        }

        if (status.state) {
          return {
            success: status.state.phase === "COMMITTED",
            transactionId: status.transactionId,
            phase: status.state.phase,
            failPointTriggered: status.state.failPointTriggered,
            errorMessage: status.state.errorMessage,
          };
        }

        return {
          ...previous,
          phase: status.phase ?? previous.phase,
        };
      });
      setSimulationMessage("Status refreshed.");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch transaction status.";
      setError(message);
    } finally {
      setRecovering(false);
    }
  };

  const handleRecoverSimulation = async () => {
    const token = localStorage.getItem("token");
    if (!token || !simulatedTransfer) {
      return;
    }

    setRecovering(true);
    setError(null);
    setSimulationMessage(null);
    try {
      const recovery = await recoverTransaction(token, simulatedTransfer.transactionId);
      setSimulationMessage(recovery.message);

      const status = await getTransactionStatus(token, simulatedTransfer.transactionId);
      if (status.found) {
        setSimulatedTransfer((previous) => {
          if (!previous) {
            return null;
          }

          if (status.state) {
            return {
              success: status.state.phase === "COMMITTED",
              transactionId: status.transactionId,
              phase: status.state.phase,
              failPointTriggered: status.state.failPointTriggered,
              errorMessage: status.state.errorMessage,
            };
          }

          return {
            ...previous,
            phase: status.phase ?? previous.phase,
          };
        });
      }

      await loadOverviewAndTransactions(token, selectedAccount);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Recovery failed.";
      setError(message);
    } finally {
      setRecovering(false);
    }
  };

  return (
    <div className="transactions-page">
      <header className="transactions-header">
        <div>
          <p className="transactions-kicker">Operations</p>
          <h1>Account Transactions</h1>
          <p className="transactions-subtitle">
            Select account, then choose Deposit/Withdraw or Make Transaction.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => navigate("/home")}
          disabled={isRecoveryRequired}
        >
          Back to Dashboard
        </button>
      </header>

      {isRecoveryRequired && (
        <p className="home-state home-state-error">
          Transaction is IN_DOUBT. Run Recover and refresh status before leaving this
          page.
        </p>
      )}

      {loading && <p className="home-state">Loading accounts...</p>}
      {error && <p className="home-state home-state-error">{error}</p>}

      <section className="transactions-panel">
        <div className="transactions-form">
          <h2>Selected Account</h2>

          <div className="transactions-input-row">
            <label htmlFor="account">acc_id</label>
            <select
              id="account"
              value={selectedAccount}
              onChange={handleAccountChange}
              disabled={accounts.length === 0}
            >
              {accounts.map((account) => (
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

          <div className="transactions-actions">
            <button className="btn btn-primary" type="button" onClick={openAdjustModal}>
              Deposit / Withdraw
            </button>
            <button className="btn btn-ghost" type="button" onClick={openTransferModal}>
              Make Transaction
            </button>
          </div>
        </div>
      </section>

      <section className="transactions-history">
        <div className="transactions-history-head">
          <h3>Last 5 Transactions</h3>
        </div>

        <div className="transactions-table-wrap">
          <table className="transactions-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>

            <tbody>
              {transactions.map((transaction) => {
                const amountNumber = Number(transaction.amount);
                const amountClass =
                  Number.isFinite(amountNumber) && amountNumber < 0
                    ? "amount-negative"
                    : "amount-positive";

                return (
                  <tr key={transaction.id}>
                    <td>{new Date(transaction.date).toLocaleString()}</td>
                    <td>{transaction.description}</td>
                    <td>{transaction.status}</td>
                    <td className={amountClass}>
                      {Number.isFinite(amountNumber) && amountNumber > 0 ? "+" : ""}
                      {transaction.amount}
                    </td>
                  </tr>
                );
              })}
              {transactions.length === 0 && !loading && (
                <tr>
                  <td colSpan={4}>No transactions found for this account.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {activeModal !== "none" && (
        <div
          className="modal-overlay"
          onClick={() => {
            void closeModal();
          }}
          role="presentation"
        >
          <div
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {activeModal === "adjust" && (
              <form className="modal-form" onSubmit={handleSubmitAdjust}>
                <h3>Deposit / Withdraw</h3>
                <p>
                  Current account (locked): <strong>{selectedAccount}</strong>
                </p>

                <div className="modal-toggle">
                  <button
                    type="button"
                    className={`btn ${adjustMode === "deposit" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setAdjustMode("deposit")}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    className={`btn ${adjustMode === "withdraw" ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setAdjustMode("withdraw")}
                  >
                    Withdraw
                  </button>
                </div>

                <div className="transactions-input-row">
                  <label htmlFor="adjustAmount">Amount</label>
                  <input
                    id="adjustAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={adjustAmount}
                    onChange={(event) => setAdjustAmount(event.target.value)}
                    placeholder="Positive amount"
                  />
                </div>

                <div className="modal-actions">
                  <button
                    className="btn btn-primary"
                    type="submit"
                    disabled={submitting || transferSubmittedOnce}
                  >
                    {submitting ? "Applying..." : "Apply"}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={closeModal}>
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {activeModal === "transfer" && (
              <form className="modal-form" onSubmit={handleSubmitTransfer}>
                <h3>Make Transaction</h3>
                <p>
                  From account (locked): <strong>{selectedAccount}</strong>
                </p>

                <div className="transactions-input-row">
                  <label htmlFor="recipientUsername">Username</label>
                  <input
                    id="recipientUsername"
                    type="text"
                    value={transferRecipientUsername}
                    onChange={(event) =>
                      setTransferRecipientUsername(event.target.value)
                    }
                    placeholder="Recipient username"
                  />
                </div>

                <div className="modal-actions modal-actions-left">
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={handleLookupRecipientAccounts}
                    disabled={submitting}
                  >
                    {submitting ? "Searching..." : "Find recipient accounts"}
                  </button>
                </div>

                {transferRecipientUser && (
                  <p>
                    Recipient user: <strong>{transferRecipientUser.username}</strong>
                  </p>
                )}

                <div className="transactions-input-row">
                  <label htmlFor="targetAccount">To account id</label>
                  <select
                    id="targetAccount"
                    value={transferTargetAccount}
                    onChange={(event) => setTransferTargetAccount(event.target.value)}
                    disabled={transferRecipientAccounts.length === 0}
                  >
                    {transferRecipientAccounts.map((account) => (
                      <option key={account.acc_id} value={account.acc_id}>
                        {account.acc_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="transactions-input-row">
                  <label htmlFor="transferAmount">Amount</label>
                  <input
                    id="transferAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    placeholder="Positive amount"
                  />
                </div>

                <div className="transactions-input-row">
                  <label htmlFor="transferFailPoint">FailPoint</label>
                  <select
                    id="transferFailPoint"
                    value={transferFailPoint}
                    onChange={(event) =>
                      setTransferFailPoint(event.target.value as FailPoint | "")
                    }
                  >
                    <option value="">No simulation (normal transfer)</option>
                    {FAIL_POINT_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                {simulatedTransfer && (
                  <div className="simulation-result">
                    <p>
                      <strong>transactionId:</strong> {simulatedTransfer.transactionId}
                    </p>
                    <p>
                      <strong>phase:</strong> {simulatedTransfer.phase}
                    </p>
                    {simulatedTransfer.failPointTriggered && (
                      <p>
                        <strong>failPoint:</strong>{" "}
                        {simulatedTransfer.failPointTriggered}
                      </p>
                    )}
                    {simulatedTransfer.errorMessage && (
                      <p>
                        <strong>error:</strong> {simulatedTransfer.errorMessage}
                      </p>
                    )}
                    {simulationMessage && (
                      <p>
                        <strong>message:</strong> {simulationMessage}
                      </p>
                    )}

                    <div className="modal-actions modal-actions-left">
                      <button
                        className="btn btn-ghost"
                        type="button"
                        onClick={handleRefreshSimulationStatus}
                        disabled={recovering}
                      >
                        {recovering ? "Refreshing..." : "Refresh status"}
                      </button>
                      {simulatedTransfer.phase === "IN_DOUBT" && (
                        <button
                          className="btn btn-primary"
                          type="button"
                          onClick={handleRecoverSimulation}
                          disabled={recovering}
                        >
                          {recovering ? "Recovering..." : "Recover"}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting
                      ? "Submitting..."
                      : transferSubmittedOnce
                        ? "Sent"
                        : "Send"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={closeModal}
                    disabled={isRecoveryRequired}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionsPage;
