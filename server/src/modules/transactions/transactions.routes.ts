import { Router } from "express";
import transactionsController from "./transactions.controller";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "transactions",
    message: "Transactions routes are active",
  });
});

router.post("/transfer", transactionsController.transfer);
router.post("/failpoint", transactionsController.setFailpoint);
router.get("/failpoint", transactionsController.getFailpoint);
router.get("/health", transactionsController.health);
router.get("/:txId", transactionsController.getTransactionStatus);
router.post("/:txId/recover", transactionsController.recoverTransaction);

export default router;
