# Job Ready Tracker

Track jobs through multiple levels (Applied → Screening → Interview → Offer → Job Ready) with real-time notifications.

## Run

```bash
npm install
npm start
```

Open http://localhost:3000.

## Features

- Kanban-style board with 5 levels; advance / move back / remove jobs.
- Notifications on every level change, with a special "JOB READY" alert at the final level.
- Real-time updates via Server-Sent Events (`/api/events`) — open multiple tabs and they stay in sync.
- In-app toasts, a notification bell with unread badge, and optional browser (desktop) notifications.
- Data persisted to `data.json`.

## API

| Method | Path                        | Description                 |
| ------ | --------------------------- | --------------------------- |
| GET    | /api/levels                 | List levels                 |
| GET    | /api/jobs                   | List jobs                   |
| POST   | /api/jobs                   | Create `{title, company, candidate?}` |
| POST   | /api/jobs/:id/advance       | Move job to next level      |
| POST   | /api/jobs/:id/level         | Set level `{level}`         |
| DELETE | /api/jobs/:id               | Remove job                  |
| GET    | /api/notifications          | List notifications          |
| POST   | /api/notifications/read     | Mark all read               |
| GET    | /api/events                 | SSE stream                  |
