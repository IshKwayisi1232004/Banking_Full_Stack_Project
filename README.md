# Banking_Full_Stack_Project

Full-stack banking app with:
- `client`: React + TypeScript + Vite
- `server`: Node.js + Express + TypeScript
- PostgreSQL for core data and ledger data

## Project structure
- `client/` - frontend app
- `server/` - backend API
- `init_schema.sql` - database schema bootstrap

## Features
- Auth: register, login, JWT-based session, `GET /auth/me`
- Accounts:
  - account overview for current user
  - create account
  - delete account
  - deposit / withdraw (with no-negative-balance protection)
- Transfers:
  - account-to-account transfer
  - last transactions per account
  - 2PC simulation with failpoints (`IN_DOUBT`, recover flow)

## Requirements
- Node.js 20+ (your project currently uses Node 22)
- npm
- PostgreSQL (or Supabase Postgres URLs)

## Environment setup
Create `server/.env` (you can copy from `server/.example_env`):

```env
PORT=5001
CORE_DB_URL=postgresql://...
LEDGER_DB_URL=postgresql://...
PG_DISABLE_SSL=false
SIMULATE_FAILURE=false
AUTH_SECRET=dev-auth-secret-change-me
AUTH_TOKEN_TTL_SECONDS=86400
BCRYPT_SALT_ROUNDS=12
```

## Install dependencies
```bash
cd server && npm install
cd ../client && npm install
```

## Run locally
Start backend:
```bash
cd server
npm run dev
```

Start frontend:
```bash
cd client
npm run dev
```

URLs:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5001`

## Build commands
Backend:
```bash
cd server
npm run typecheck
npm run build
npm run start
```

Frontend:
```bash
cd client
npm run build
npm run preview
```

## Main API routes
Auth:
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Accounts:
- `POST /accounts`
- `GET /accounts/overview`
- `GET /accounts/recipient-accounts?username=...`
- `GET /accounts/:accId/transactions?limit=5`
- `POST /accounts/:accId/transfer`
- `POST /accounts/:accId/adjust-balance`
- `DELETE /accounts/:accId`

Transactions (2PC simulation):
- `POST /transactions/transfer`
- `GET /transactions/:txId`
- `POST /transactions/:txId/recover`
- `GET /transactions/failpoint`
- `POST /transactions/failpoint`

## Notes
- Current client-server API base is `http://localhost:5001`.
- For simulation flows, transfer may return non-200 with transaction state; use status/recover endpoints to finalize.
- Extra module-level docs are in:
  - `client/README.md`
  - `client/src/README.md`
  - `server/README.md`
  - `server/src/README.md`

