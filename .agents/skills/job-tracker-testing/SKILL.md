---
name: job-tracker-ui-testing
description: Run and capture Job Ready Tracker lifecycle and real-time notification tests against the correct checkout.
---

# Job Ready Tracker runtime testing

## Startup and isolation
- Run npm install and npm start from the intended job-ready-tracker directory.
- Check port ownership before testing: a different checkout may already serve
  port 3000. Use PORT=3001 npm start when needed instead of accidentally testing
  an older copy. Navigate both test tabs to the same chosen port.
- No login is required. data.json is local to the app directory and gitignored.
  Only reset disposable test data; restarting without resetting retains state.

## UI evidence
- Use a normal desktop width (e.g. 1600px) and maximize the browser.
- Create one uniquely named job and leave candidate empty to prove it is optional.
- Capture screenshots immediately after each mutation: toasts expire in 5 seconds.
- Inspect notification history as well as badge counts; board updates alone do
  not prove the notification event arrived.
- Open a second tab before mutating the first. Switch to the already-loaded
  second tab without reloading to prove SSE synchronization. Verify read-state
  and deletion broadcasts as well as level updates.
- Capture the final-level board before opening the bell: the notification panel
  overlays the rightmost column. Capture the green ready list entry separately.
- Exercise browser confirm dialogs in separate tool actions so both Cancel and
  OK outcomes are visible.
- Reload with a surviving card to test job persistence, then reload after deletion
  to confirm the removal persisted. Distinguish page reload from server-restart
  persistence in the report.

## Devin Secrets Needed
None for the local app.
