# Server (Backend)

A small backend built with **Node.js + Express + TypeScript**.

## Tech Stack
- `express` — HTTP API
- `dotenv` — loads environment variables from `.env`
- `cors` — enables requests from frontend origins
- `morgan` — HTTP request logging
- `typescript` + `tsx` — TypeScript development and runtime

## Install Dependencies
```bash
cd server
npm install
```

## Environment Variables
File: `.env`

Minimum setup:
```env
PORT=5001
```

## Run in Development
```bash
cd server
npm run dev
```

## Build and Run in Production
```bash
cd server
npm run build
npm run start
```

## Type Check
```bash
cd server
npm run typecheck
```
