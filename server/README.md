# Server (Backend)

Node.js + Express + TypeScript API for authentication, accounts, and transactions.

## Run locally
```bash
cd server
npm install
npm run dev
```

Default API URL: `http://localhost:5001`

## Required environment variables
Create `server/.env`:

```env
PORT=5001
CORE_DB_URL=postgresql://...
LEDGER_DB_URL=postgresql://...
JWT_SECRET=your_secret
JWT_EXPIRES_IN=24h
```

## Build / start / typecheck
```bash
cd server
npm run build
npm run start
npm run typecheck
```

## Main folders
- `src/modules/auth` - register/login/me + JWT middleware
- `src/modules/accounts` - overview, account actions, account transactions
- `src/modules/transactions` - 2PC coordinator, failpoints, recover
- `src/db` - database pools
