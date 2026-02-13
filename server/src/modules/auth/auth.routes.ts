import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "auth",
    message: "Auth routes stub is working",
  });
});

router.post("/register", (_req, res) => {
  res.status(501).json({
    module: "auth",
    route: "POST /auth/register",
    message: "Stub: not implemented yet",
  });
});

router.post("/login", (_req, res) => {
  res.status(501).json({
    module: "auth",
    route: "POST /auth/login",
    message: "Stub: not implemented yet",
  });
});

export default router;
