import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.status(200).json({
    module: "users",
    message: "Users routes stub is working",
  });
});

router.get("/:id", (req, res) => {
  res.status(501).json({
    module: "users",
    route: "GET /users/:id",
    params: req.params,
    message: "Stub: not implemented yet",
  });
});

export default router;
