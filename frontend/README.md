# TaskForge frontend

TaskForge is a React/Vite frontend for the Project Management API. It uses the monochrome workspace theme throughout authentication, dashboard, projects, tasks, team, notes, and account settings.

## Run locally

From the repository root, keep the API running in one terminal:

```powershell
npm run dev
```

Then start the frontend in a second terminal:

```powershell
npm run dev:frontend
```

Open [http://localhost:5173](http://localhost:5173). The Vite development server forwards `/api/*` and `/images/*` to `http://localhost:8000`. If the API uses another port, update the proxy targets in `frontend/vite.config.js`.

## Build

```powershell
npm run build:frontend
```

For a deployed frontend, set `VITE_API_BASE_URL` to the API base URL before building. The development proxy only applies to Vite's development server.

## Notes

- Sign-in uses the backend's HttpOnly cookies; the frontend does not save tokens in local storage.
- The API has no task due-date field yet, so the dashboard uses actual project/task counts and recent open tasks rather than displaying invented deadlines.
- Email verification and password recovery depend on the backend's SMTP configuration and redirect settings.
