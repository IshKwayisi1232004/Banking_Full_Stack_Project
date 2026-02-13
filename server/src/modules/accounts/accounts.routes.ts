import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "accounts",
    message: "Accounts routes stub is working",
  });
});

router.post("/", (_req, res) => {
  res.status(501).json({
    module: "accounts",
    route: "POST /accounts",
    message: "Stub: not implemented yet",
  });
});

export default router;
