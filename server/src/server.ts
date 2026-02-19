import "dotenv/config";
import app from "./app";
import { corePool, ledgerPool } from "./db";

const PORT = Number(process.env.PORT) || 5000;

async function assertDatabaseConnections(): Promise<void> {
  await corePool.query("SELECT 1");
  console.log("Core DB connected");

  await ledgerPool.query("SELECT 1");
  console.log("Ledger DB connected");
}

async function startServer(): Promise<void> {
  try {
    await assertDatabaseConnections();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown startup error";
    console.error(`Failed to start server: ${message}`);
    process.exit(1);
  }
}

void startServer();
