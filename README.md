# AttendX

Smart AI academic attendance and management system built with MERN-style React + Node, TypeScript, Tailwind, PostgreSQL/Neon, Socket.IO, JWT, QR attendance, GPS geofencing, and OpenRouter AI.

## Structure

- `frontend` - Vite React TypeScript app with Tailwind, responsive pages, dashboards, and 3D landing scene.
- `backend` - Express TypeScript API with Neon/Postgres schema, JWT auth, QR sessions, Haversine geofence validation, uploads, analytics, OpenRouter, and WebSocket sync.

## Run

```bash
cd frontend
npm install
npm run dev
```

```bash
cd backend
npm install
copy .env.example .env
npm run dev
```

Set `DATABASE_URL`, `JWT_SECRET`, `QR_ENCRYPTION_SECRET`, and optionally `OPENROUTER_API_KEY` in `backend/.env`.

## Deployment Environment Variables

### Vercel frontend

```bash
VITE_API_URL=https://attendx-production-bd19.up.railway.app
```

### Railway backend

```bash
PORT=4000
CLIENT_URL=https://attendx-tau.vercel.app
CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173,https://attendx-tau.vercel.app
JWT_SECRET=replace-with-a-long-random-secret
QR_ENCRYPTION_SECRET=replace-with-32-plus-character-secret
DATABASE_URL=postgresql://USER:PASSWORD@HOST.neon.tech/attendx?sslmode=require
OPENROUTER_API_KEY=
OPENROUTER_MODEL=deepseek/deepseek-chat-v3-0324:free
```
