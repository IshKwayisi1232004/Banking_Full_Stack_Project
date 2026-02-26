export interface AccountInfo {
  acc_id: string;
  user_id: string;
  balance: string;
}

export interface OverviewUser {
  id: string;
  username: string;
}

export interface AccountsOverviewResponse {
  user: OverviewUser;
  accounts: AccountInfo[];
}

export interface AccountTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  status: string;
}

export interface AccountTransactionsResponse {
  account: AccountInfo;
  transactions: AccountTransaction[];
}

export interface RecipientAccountsResponse {
  user: OverviewUser;
  accounts: AccountInfo[];
}

export type FailPoint =
  | "BEFORE_CORE_PREPARE"
  | "BEFORE_LEDGER_PREPARE"
  | "BEFORE_COMMIT"
  | "AFTER_CORE_COMMIT"
  | "AFTER_LEDGER_COMMIT";

export interface CoordinatorState {
  transactionId: string;
  phase: string;
  corePrepared: boolean;
  ledgerPrepared: boolean;
  coreCommitted: boolean;
  ledgerCommitted: boolean;
  rolledBack: boolean;
  failPointTriggered?: FailPoint;
  errorMessage?: string;
}

export interface SimulatedTransferResponse {
  success: boolean;
  transactionId: string;
  state: CoordinatorState;
}

export interface TransactionStatusResponse {
  found: boolean;
  transactionId: string;
  phase?: string;
  ledgerStatus?: string;
  state?: CoordinatorState;
}

export interface RecoverTransactionResponse {
  success: boolean;
  transactionId: string;
  previousLedgerStatus?: string;
  currentLedgerStatus?: string;
  message: string;
}
