import { Request, Response } from "express";
import { failpointManager } from "./FailpointManager";
import { TransactionCoordinator } from "./TransactionCoordinator";
import { FailPoint, TransferRequest } from "./transaction.types";

interface TransferBody {
  senderId?: string;
  receiverId?: string;
  senderAccountId?: string;
  receiverAccountId?: string;
  amount?: number | string;
  failPoint?: FailPoint | string;
}

interface FailpointBody {
  enabled?: boolean;
  oneShot?: boolean;
  failPoint?: FailPoint | string | null;
}

const transactionCoordinator = new TransactionCoordinator();

function parseFailPoint(input?: string | FailPoint | null): FailPoint | undefined {
  if (input === null || input === undefined || input === "") {
    return undefined;
  }

  if (Object.values(FailPoint).includes(input as FailPoint)) {
    return input as FailPoint;
  }

  return undefined;
}

function envFailureEnabled(): boolean {
  return String(process.env.SIMULATE_FAILURE ?? "").toLowerCase() === "true";
}

export const transactionsController = {
  transfer: async (req: Request, res: Response): Promise<Response> => {
    try {
      const body = (req.body ?? {}) as TransferBody;
      const { senderId, receiverId, senderAccountId, receiverAccountId, amount } =
        body;

      if (!senderId || !receiverId || amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          message: "senderId, receiverId, and amount are required.",
        });
      }

      const requestFailPoint =
        parseFailPoint(body.failPoint) ??
        (envFailureEnabled() ? FailPoint.BEFORE_COMMIT : undefined);

      const transferRequest: TransferRequest = {
        fromUserId: senderId,
        toUserId: receiverId,
        fromAccountId: senderAccountId ?? senderId,
        toAccountId: receiverAccountId ?? receiverId,
        amount,
        failPoint: requestFailPoint,
      };

      const result = await transactionCoordinator.executeTransfer(transferRequest);
      const statusCode = result.success ? 200 : 409;

      return res.status(statusCode).json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected transfer error";
      return res.status(500).json({
        success: false,
        message,
      });
    }
  },

  setFailpoint: async (req: Request, res: Response): Promise<Response> => {
    const body = (req.body ?? {}) as FailpointBody;
    const enabled = body.enabled ?? false;
    const oneShot = body.oneShot ?? true;
    const parsedFailPoint = parseFailPoint(body.failPoint ?? undefined);

    if (!enabled) {
      failpointManager.clearFailPoint();
      return res.status(200).json({
        success: true,
        message: "Failpoint disabled",
        activeFailPoint: null,
      });
    }

    const failPointToSet = parsedFailPoint ?? FailPoint.BEFORE_COMMIT;
    failpointManager.setFailPoint(failPointToSet, oneShot);

    return res.status(200).json({
      success: true,
      message: "Failpoint enabled",
      activeFailPoint: failpointManager.getFailPoint(),
      oneShot,
      availableFailPoints: failpointManager.getAvailableFailPoints(),
    });
  },

  getTransactionStatus: async (
    req: Request,
    res: Response,
  ): Promise<Response> => {
    const { txId } = req.params;
    if (!txId) {
      return res.status(400).json({
        found: false,
        message: "Missing transaction id.",
      });
    }

    const status = await transactionCoordinator.getTransactionStatus(txId);
    if (!status.found) {
      return res.status(404).json(status);
    }

    return res.status(200).json(status);
  },

  recoverTransaction: async (req: Request, res: Response): Promise<Response> => {
    const { txId } = req.params;
    if (!txId) {
      return res.status(400).json({
        success: false,
        message: "Missing transaction id.",
      });
    }

    const result = await transactionCoordinator.recoverTransaction(txId);
    if (!result.success && result.message.includes("not found")) {
      return res.status(404).json(result);
    }

    return res.status(result.success ? 200 : 409).json(result);
  },

  health: async (_req: Request, res: Response): Promise<Response> => {
    const result = await transactionCoordinator.healthCheck();
    return res.status(result.ok ? 200 : 503).json(result);
  },

  getFailpoint: async (_req: Request, res: Response): Promise<Response> => {
    return res.status(200).json({
      activeFailPoint: failpointManager.getFailPoint(),
      availableFailPoints: failpointManager.getAvailableFailPoints(),
    });
  },
};

export default transactionsController;
