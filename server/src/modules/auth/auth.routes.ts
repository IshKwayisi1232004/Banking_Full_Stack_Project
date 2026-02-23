import { Router } from "express";
import { authController } from "./auth.controller";
import { requireAuth } from "./auth.middleware";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "auth",
    message: "Auth routes are working",
  });
});

router.post("/register", (req, res) => void authController.register(req, res));
router.post("/login", (req, res) => void authController.login(req, res));
router.get("/me", requireAuth, (req, res) => void authController.me(req, res));

export default router;
