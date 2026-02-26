# Finance CSB (Local Stack)

Finance CSB is a full local deployment of the CSB finance app:
- Frontend: Vite + React + TypeScript
- Backend API: Node.js + Express (`server/`)
- Database: PostgreSQL

This project runs without hosted Supabase.  
The frontend uses a local Supabase-compatible client that talks to the local API.

## 1) Prerequisites

- Node.js 18+ (Node 20 recommended)
- npm
- PostgreSQL 14+ (local or reachable from this machine)
- `psql` CLI available in PATH

## 2) Install dependencies

From project root:

```bash
npm install
npm install --prefix server
```

## 3) Database setup (first run)

Create database:

```bash
createdb financecsb
```

Enable UUID generator used by schema:

```bash
psql -d financecsb -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
```

Load schema and seed data:

```bash
psql -d financecsb -f schema.sql
```

## 4) Environment configuration

### Root `.env` (frontend)

```env
VITE_API_URL=/api
```

`/api` is proxied by Vite to `http://localhost:4000`.

### `server/.env` (backend)

```env
DATABASE_URL=postgresql://postgres:123123@localhost:5432/financecsb
PORT=4000
DEFAULT_LOCAL_PASSWORD=123123
SERVER_TIME_ZONE=Asia/Tokyo
```

Notes:
- `DATABASE_URL` is required.
- `DEFAULT_LOCAL_PASSWORD` is used when local users are auto-created/reset.
- `SERVER_TIME_ZONE` is applied at DB connection level.

## 5) Run locally

Use two terminals.

Terminal 1 (API):

```bash
npm run dev:server
```

Terminal 2 (frontend):

```bash
npm run dev
```

Open app:
- UI: `http://localhost:8080`
- API health: `http://localhost:4000/api/health`

Expected API root response (`http://localhost:4000/`): JSON metadata, not a web page.

## 6) Local login

On server boot, local users are bootstrapped from DB profiles if `users` table is empty.

Default admin account used in tests:
- Email: `jjs@csb.com`
- Password: value of `DEFAULT_LOCAL_PASSWORD` (default `123123`)

If login fails, verify:
- `users` table has records
- `profiles.is_active = true` for that user
- email is lowercase and ends with `@csb.com`

## 7) Scripts

### Root scripts

- `npm run dev` - start Vite frontend
- `npm run dev:server` - start backend in watch mode (`server/`)
- `npm run build` - production frontend build
- `npm run test` - frontend tests (Vitest)

### Server scripts

- `npm run dev --prefix server` - start API with file watch
- `npm run start --prefix server` - start API once
- `npm test --prefix server` - backend integration tests

## 8) Reset month + transaction data (manual)

From `server/`, run:

```powershell
@'
const dotenv = require("dotenv");
const { Pool } = require("pg");
dotenv.config({ path: ".env" });

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query(`
    TRUNCATE TABLE
      transactions,
      monthly_summaries,
      person_monthly_summaries,
      person_salary_balances,
      salary_settings,
      wallet_starting_balances,
      months
    RESTART IDENTITY CASCADE;
  `);
  await pool.end();
  console.log("Cleared months + transactions data.");
})().catch((e) => { console.error(e); process.exit(1); });
'@ | node -
```

This clears only month/transaction-related data and keeps users/teams/profiles intact.

## 9) Quick troubleshooting

- API says "Cannot GET /":
  - Confirm server is running on `PORT` in `server/.env`.
  - Use `http://localhost:4000/api/health` to check DB connectivity.

- Frontend loads but API calls fail:
  - Ensure frontend runs on port `8080` so Vite proxy `/api` works.
  - If using a different frontend port, set `VITE_API_URL` to full API URL.

- Invalid user/password:
  - Confirm `DEFAULT_LOCAL_PASSWORD` matches what you are using.
  - Reset from Admin panel or update `users.password_hash` in DB.

- DB errors on startup:
  - Confirm `DATABASE_URL` is correct.
  - Confirm schema has been loaded and `pgcrypto` extension exists.

## 10) LAN access (optional)

The Vite dev server is configured with `host: "::"`, so devices on the same network can reach the UI using:

`http://<your-machine-ip>:8080`

For API access from other devices, ensure:
- backend is reachable on `http://<your-machine-ip>:4000`
- OS firewall allows ports `8080` and `4000`
