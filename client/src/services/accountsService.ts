import type {
  AccountTransactionsResponse,
  AccountsOverviewResponse,
  FailPoint,
  RecoverTransactionResponse,
  RecipientAccountsResponse,
  SimulatedTransferResponse,
  TransactionStatusResponse,
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

export async function deleteAccount(
  token: string,
  accountId: string,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  await parseResponse<{ success: boolean }>(response);
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

export async function getRecipientAccounts(
  token: string,
  username: string,
): Promise<RecipientAccountsResponse> {
  const response = await fetch(
    `${API_BASE_URL}/accounts/recipient-accounts?username=${encodeURIComponent(username)}`,
    {
      method: "GET",
      headers: authHeaders(token),
    },
  );
  return parseResponse<RecipientAccountsResponse>(response);
}

type SimulatedTransferPayload = {
  senderId: string;
  receiverId: string;
  senderAccountId: string;
  receiverAccountId: string;
  amount: number;
  failPoint: FailPoint;
};

export async function simulateTransferWithFailPoint(
  token: string,
  payload: SimulatedTransferPayload,
): Promise<SimulatedTransferResponse> {
  const response = await fetch(`${API_BASE_URL}/transactions/transfer`, {
    method: "POST",
    headers: {
      ...authHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = (await response.json()) as
    | SimulatedTransferResponse
    | { message?: string };

  if (
    typeof body === "object" &&
    body !== null &&
    "transactionId" in body &&
    "state" in body
  ) {
    return body as SimulatedTransferResponse;
  }

  if (!response.ok) {
    throw new Error(
      "message" in body && typeof body.message === "string"
        ? body.message
        : "Request failed.",
    );
  }

  throw new Error("Unexpected transfer response.");
}

export async function getTransactionStatus(
  token: string,
  transactionId: string,
): Promise<TransactionStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/transactions/${transactionId}`, {
    method: "GET",
    headers: authHeaders(token),
  });
  return parseResponse<TransactionStatusResponse>(response);
}

export async function recoverTransaction(
  token: string,
  transactionId: string,
): Promise<RecoverTransactionResponse> {
  const response = await fetch(
    `${API_BASE_URL}/transactions/${transactionId}/recover`,
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  return parseResponse<RecoverTransactionResponse>(response);
}
