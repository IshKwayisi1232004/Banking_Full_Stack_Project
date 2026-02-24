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
