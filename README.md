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
