# DUYS (React + Node)

Rewrite of the Flask DUYS social platform: **Vite + React** SPA and **Express** API, PostgreSQL, Socket.io.

## Quick start

SQLite is the local default (no Docker). `docker-compose.yml` is included if you later switch `DATABASE_URL` to PostgreSQL.

```bash
cd DUYS-node
copy .env.example .env
npm install
npm run db:generate
npm run db:push
npm run dev:server
# another terminal
npm run dev:client
```

Open http://localhost:5173 — sign up, or use the admin account from `.env`.
