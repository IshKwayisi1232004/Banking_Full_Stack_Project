import { Router } from "express";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }
    const accounts = await db.query(
      `SELECT a.acc_id, a.created_at, b.amount
       FROM accounts a
       LEFT JOIN balances b ON b.acc_id = a.acc_id
       WHERE a.user_id = $1`,
      [userId],
    );
    res.json(accounts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "Unauthorized",
      });
    }
    const accounts = await db.query(
      `SELECT a.acc_id, a.created_at, b.amount
       FROM accounts a
       LEFT JOIN balances b ON b.acc_id = a.acc_id
       WHERE a.user_id = $1`,
      [userId],
    );
    res.json(accounts.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

export default router;
