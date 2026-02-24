import type {
  AccountTransactionsResponse,
  AccountsOverviewResponse,
} from "../types/account";

const API_BASE_URL = "http://localhost:5001";

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { message?: string };
  if (!response.ok) {
    throw new Error(payload.message ?? "Request failed.");
  }
  return payload;
}

export async function getAccountsOverview(
  token: string,
): Promise<AccountsOverviewResponse> {
  const response = await fetch(`${API_BASE_URL}/accounts/overview`, {
    method: "GET",
    headers: authHeaders(token),
  });
  return parseResponse<AccountsOverviewResponse>(response);
}

export async function getAccountTransactions(
  token: string,
  accountId: string,
): Promise<AccountTransactionsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/${accountId}/transactions?limit=5`,
    {
      method: "GET",
      headers: authHeaders(token),
    },
  );
  return parseResponse<AccountTransactionsResponse>(response);
}

export async function adjustAccountBalance(
  token: string,
  accountId: string,
  delta: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/${accountId}/adjust-balance`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ delta }),
    },
  );
  await parseResponse<{ account: unknown }>(response);
}

export async function createAccount(
  token: string,
  initialBalance = 0,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ initialBalance }),
  });
  await parseResponse<{ account: unknown }>(response);
}

export async function makeAccountTransfer(
  token: string,
  fromAccountId: string,
  toAccountId: string,
  amount: number,
): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/${fromAccountId}/transfer`,
    {
      method: "POST",
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ toAccountId, amount }),
    },
  );
  await parseResponse<{ success: boolean }>(response);
}
