const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data.json");

const LEVELS = [
  { id: 1, name: "Applied", description: "Application submitted" },
  { id: 2, name: "Screening", description: "Resume / phone screening" },
  { id: 3, name: "Interview", description: "Technical / HR interview rounds" },
  { id: 4, name: "Offer", description: "Offer extended" },
  { id: 5, name: "Job Ready", description: "Onboarding complete, ready to start" },
];

let state = { jobs: [], notifications: [], nextJobId: 1, nextNotifId: 1 };

function load() {
  if (fs.existsSync(DATA_FILE)) {
    state = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  }
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

const sseClients = new Set();

function broadcast(event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

function levelById(id) {
  return LEVELS.find((l) => l.id === id);
}

function notify(job, type, message) {
  const notification = {
    id: state.nextNotifId++,
    jobId: job.id,
    type,
    message,
    read: false,
    createdAt: new Date().toISOString(),
  };
  state.notifications.unshift(notification);
  state.notifications = state.notifications.slice(0, 200);
  save();
  broadcast("notification", notification);
  return notification;
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/levels", (_req, res) => res.json(LEVELS));

app.get("/api/jobs", (_req, res) => res.json(state.jobs));

app.post("/api/jobs", (req, res) => {
  const { title, company, candidate } = req.body || {};
  if (!title || !company) {
    return res.status(400).json({ error: "title and company are required" });
  }
  const now = new Date().toISOString();
  const job = {
    id: state.nextJobId++,
    title: String(title).trim(),
    company: String(company).trim(),
    candidate: candidate ? String(candidate).trim() : "",
    level: 1,
    history: [{ level: 1, at: now }],
    createdAt: now,
    updatedAt: now,
  };
  state.jobs.push(job);
  save();
  broadcast("job", job);
  notify(job, "created", `${job.title} at ${job.company} entered level 1 (${levelById(1).name}).`);
  res.status(201).json(job);
});

function moveJob(job, newLevel) {
  const target = levelById(newLevel);
  if (!target) return { error: "invalid level" };
  if (newLevel === job.level) return { error: "job already at that level" };
  const direction = newLevel > job.level ? "advanced" : "moved back";
  job.level = newLevel;
  job.updatedAt = new Date().toISOString();
  job.history.push({ level: newLevel, at: job.updatedAt });
  save();
  broadcast("job", job);
  const isReady = newLevel === LEVELS[LEVELS.length - 1].id;
  notify(
    job,
    isReady ? "ready" : "level",
    isReady
      ? `${job.title} at ${job.company} is JOB READY!`
      : `${job.title} at ${job.company} ${direction} to level ${newLevel} (${target.name}).`
  );
  return { job };
}

app.post("/api/jobs/:id/advance", (req, res) => {
  const job = state.jobs.find((j) => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: "job not found" });
  if (job.level >= LEVELS.length) {
    return res.status(400).json({ error: "job is already at the final level" });
  }
  const result = moveJob(job, job.level + 1);
  if (result.error) return res.status(400).json(result);
  res.json(result.job);
});

app.post("/api/jobs/:id/level", (req, res) => {
  const job = state.jobs.find((j) => j.id === Number(req.params.id));
  if (!job) return res.status(404).json({ error: "job not found" });
  const result = moveJob(job, Number(req.body && req.body.level));
  if (result.error) return res.status(400).json(result);
  res.json(result.job);
});

app.delete("/api/jobs/:id", (req, res) => {
  const idx = state.jobs.findIndex((j) => j.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "job not found" });
  const [job] = state.jobs.splice(idx, 1);
  save();
  broadcast("job-deleted", { id: job.id });
  notify(job, "deleted", `${job.title} at ${job.company} was removed.`);
  res.status(204).end();
});

app.get("/api/notifications", (_req, res) => res.json(state.notifications));

app.post("/api/notifications/read", (_req, res) => {
  state.notifications.forEach((n) => (n.read = true));
  save();
  broadcast("notifications-read", {});
  res.json({ ok: true });
});

app.get("/api/events", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: {}\n\n`);
  sseClients.add(res);
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

load();
app.listen(PORT, () => {
  console.log(`Job Ready Tracker running at http://localhost:${PORT}`);
});
