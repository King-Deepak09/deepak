const state = { levels: [], jobs: [], notifications: [] };

const board = document.getElementById("board");
const badge = document.getElementById("badge");
const panel = document.getElementById("panel");
const notifList = document.getElementById("notif-list");
const toasts = document.getElementById("toasts");
const cardTpl = document.getElementById("job-card-tpl");

async function api(url, options) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || res.statusText);
  }
  return res.status === 204 ? null : res.json();
}

function renderBoard() {
  board.innerHTML = "";
  const lastLevel = state.levels[state.levels.length - 1];
  for (const level of state.levels) {
    const jobs = state.jobs.filter((j) => j.level === level.id);
    const col = document.createElement("section");
    col.className = "column" + (level.id === lastLevel.id ? " final" : "");
    col.innerHTML = `
      <div class="column-header">
        <h2>Level ${level.id}: ${level.name}</h2>
        <span class="count">${jobs.length}</span>
      </div>
      <div class="column-desc">${level.description}</div>`;
    for (const job of jobs) col.appendChild(renderCard(job, lastLevel));
    board.appendChild(col);
  }
}

function renderCard(job, lastLevel) {
  const node = cardTpl.content.firstElementChild.cloneNode(true);
  node.querySelector(".card-title").textContent = job.title;
  node.querySelector(".card-company").textContent = job.company;
  node.querySelector(".card-candidate").textContent = job.candidate;
  node.querySelector(".progress-bar").style.width =
    `${(job.level / state.levels.length) * 100}%`;

  const back = node.querySelector(".back");
  const advance = node.querySelector(".advance");
  back.disabled = job.level === 1;
  advance.disabled = job.level === lastLevel.id;
  if (advance.disabled) advance.textContent = "Ready";

  advance.addEventListener("click", () =>
    api(`/api/jobs/${job.id}/advance`, { method: "POST" }).catch(showError)
  );
  back.addEventListener("click", () =>
    api(`/api/jobs/${job.id}/level`, {
      method: "POST",
      body: JSON.stringify({ level: job.level - 1 }),
    }).catch(showError)
  );
  node.querySelector(".delete").addEventListener("click", () => {
    if (confirm(`Remove "${job.title}" at ${job.company}?`)) {
      api(`/api/jobs/${job.id}`, { method: "DELETE" }).catch(showError);
    }
  });
  return node;
}

function renderNotifications() {
  const unread = state.notifications.filter((n) => !n.read).length;
  badge.textContent = unread;
  badge.classList.toggle("hidden", unread === 0);

  notifList.innerHTML = "";
  if (state.notifications.length === 0) {
    notifList.innerHTML = '<li class="empty">No notifications yet</li>';
    return;
  }
  for (const n of state.notifications) {
    const li = document.createElement("li");
    li.className = `${n.read ? "" : "unread"} ${n.type}`;
    li.innerHTML = `${escapeHtml(n.message)}<time>${new Date(n.createdAt).toLocaleString()}</time>`;
    notifList.appendChild(li);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function showToast(message, type = "level") {
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.textContent = message;
  toasts.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

function showError(err) {
  showToast(`Error: ${err.message}`, "deleted");
}

function pushBrowserNotification(n) {
  if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
    new Notification("Job Ready Tracker", { body: n.message });
  }
}

function upsertJob(job) {
  const idx = state.jobs.findIndex((j) => j.id === job.id);
  if (idx === -1) state.jobs.push(job);
  else state.jobs[idx] = job;
  renderBoard();
}

function connectEvents() {
  const es = new EventSource("/api/events");
  es.addEventListener("job", (e) => upsertJob(JSON.parse(e.data)));
  es.addEventListener("job-deleted", (e) => {
    const { id } = JSON.parse(e.data);
    state.jobs = state.jobs.filter((j) => j.id !== id);
    renderBoard();
  });
  es.addEventListener("notification", (e) => {
    const n = JSON.parse(e.data);
    state.notifications.unshift(n);
    renderNotifications();
    showToast(n.message, n.type);
    pushBrowserNotification(n);
  });
  es.addEventListener("notifications-read", () => {
    state.notifications.forEach((n) => (n.read = true));
    renderNotifications();
  });
  es.onerror = () => {
    es.close();
    setTimeout(connectEvents, 3000);
  };
}

document.getElementById("job-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/jobs", { method: "POST", body: JSON.stringify(data) });
    form.reset();
    form.title.focus();
  } catch (err) {
    showError(err);
  }
});

document.getElementById("bell").addEventListener("click", () => {
  panel.classList.toggle("hidden");
});
document.getElementById("close-panel").addEventListener("click", () => {
  panel.classList.add("hidden");
});
document.getElementById("mark-read").addEventListener("click", () => {
  api("/api/notifications/read", { method: "POST" }).catch(showError);
});

const enablePush = document.getElementById("enable-push");
if (!("Notification" in window)) {
  enablePush.classList.add("hidden");
} else if (Notification.permission === "granted") {
  enablePush.textContent = "Browser alerts on";
  enablePush.disabled = true;
}
enablePush.addEventListener("click", async () => {
  const perm = await Notification.requestPermission();
  if (perm === "granted") {
    enablePush.textContent = "Browser alerts on";
    enablePush.disabled = true;
  }
});

async function init() {
  const [levels, jobs, notifications] = await Promise.all([
    api("/api/levels"),
    api("/api/jobs"),
    api("/api/notifications"),
  ]);
  state.levels = levels;
  state.jobs = jobs;
  state.notifications = notifications;
  renderBoard();
  renderNotifications();
  connectEvents();
}

init().catch(showError);
