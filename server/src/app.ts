import express from "express";
import cors from "cors";
import morgan from "morgan";

import authRoutes from "./modules/auth/auth.routes";
import usersRoutes from "./modules/users/users.routes";
import accountsRoutes from "./modules/accounts/accounts.routes";
import transactionsRoutes from "./modules/transactions/transactions.routes";

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.use("/auth", authRoutes);
app.use("/users", usersRoutes);
app.use("/accounts", accountsRoutes);
app.use("/transactions", transactionsRoutes);

export default app;
