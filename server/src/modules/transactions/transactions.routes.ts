import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "transactions",
    message: "Transactions routes stub is working",
  });
});

router.post("/transfer", (_req, res) => {
  res.status(501).json({
    module: "transactions",
    route: "POST /transactions/transfer",
    message: "Stub: not implemented yet",
  });
});

export default router;
