# Queue Operations Console

A front-desk queue management console for busy clinic staff, built for the **Frontend Lead – Technical Assessment** (Part A: build, Part B: `REVIEW.md`).

Front-desk staff manage a waiting queue on a desktop or tablet. They are constantly interrupted, often standing, frequently talking to a customer while using the console. Every design decision in this repo starts from that context.

## Live demo & repo

- **Repo:** https://github.com/devu5-6/PROQAAI
- **Deployed app:** https://clinic-dashboard-zeta-liart.vercel.app/ (mocks enabled via `VITE_ENABLE_MOCKS=true` — see Deployment below)
- **Storybook:** `npm run storybook` → http://localhost:6006

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173 — MSW mocks all API traffic
npm test           # unit tests (vitest)
npm run typecheck  # strict TS, no emit
npm run build:app  # typecheck + production build
npm run storybook  # component workshop + a11y addon
```

The mock API (MSW) is enabled automatically in dev. It simulates 350–900 ms latency and a **~10% random failure rate** — you will see real error toasts and rollbacks. Force deterministic outcomes with headers `x-force-failure: 1` / `x-force-success: 1` (used by tests; see `src/mocks/handlers.ts`). For a demo or screenshot session that needs a quiet server, set `VITE_MOCK_FAILURE_RATE=0` in `.env.local`; the default stays at the brief's 10%.

## Deployment

There is no backend in this repository, so a deployed copy needs the mock service worker switched on. `Vite` sets `MODE=production` on a deploy, and `src/main.tsx` only starts MSW when the mode is **not** production — or when `VITE_ENABLE_MOCKS=true`:

```bash
# Vercel / Netlify: add this under Project Settings → Environment Variables
VITE_ENABLE_MOCKS=true
```

Without it the build is fine but the board shows "Could not load the queue", because every `/api` request falls through to the static host's 404. Set the variable **before** the deploy, and rebuild — it is baked in at build time, not read at runtime.

The worker script itself (`public/mockServiceWorker.js`) is committed, and the SPA needs no rewrite rules: MSW answers `/api` in the browser before any request reaches the host. `npm run build:app` produces a static `dist/` that can be served from any static host.

**Live deployment:** https://clinic-dashboard-zeta-liart.vercel.app/ — built with `VITE_ENABLE_MOCKS=true`, so the full mock API (latency, failures, optimistic rollbacks) works out of the box.

## What's inside

### Functional requirements
| Requirement | Where |
|---|---|
| Live queue board (position, name, wait time, status), near real time | `src/app/QueueTable.tsx`, `src/app/use-queue-query.ts` (5 s polling) |
| Call next / mark served / mark no-show / move to another queue | `src/app/use-queue-actions.ts` (optimistic), row + panel actions |
| Customer detail panel without losing the queue view | `src/app/CustomerPanel.tsx` (drawer; board stays mounted beside it on ≥900 px) |
| Summary strip: waiting, average wait, longest wait — long waits stand out | `src/app/SummaryStrip.tsx` (alert card: color + icon + text) |

### Engineering requirements
| Requirement | Where |
|---|---|
| Mock API with latency + ~10% failures; loading/empty/error/retry states | `src/mocks/`, `SkeletonRows`, `EmptyState`, `ErrorState` |
| Optimistic updates with rollback + clear feedback | `use-queue-actions.ts` — cache patched instantly, restored on rejection, toast always |
| Real-time updates; arrivals must not jump under the cursor | 5 s polling + stable render order (`src/lib/stability.ts`) + memoized rows (`QueueTable.tsx`); new arrivals animate in place instead of reshuffling |
| Mini design system: tokens + 6–8 components | `src/styles/tokens.css` + `Button, Badge, Select, Drawer, Toast, EmptyState, ErrorState, SkeletonRows` with Storybook stories |
| Accessibility: keyboard operable, visible focus, contrast, no color-only info | global `:focus-visible`, skip link, drawer focus trap + Escape, `aria-live` toasts, wait pills use icon+text+color, status badges use icon+label |
| Responsive: desktop → tablet portrait | breakpoints at 1100 px and 900 px; low-frequency columns hide on tablet, full data stays in the detail panel |

## Architecture in 60 seconds

- **State:** [TanStack Query v5](https://tanstack.com/query) as the server-state store. Queue data is server data with a write path — caching, polling, retries, and optimistic patch/rollback are exactly what it's for. No Redux/Zustand needed; the only client state is `queueId`, the selected customer, and visible columns (plain `useState`).
- **Styling:** hand-rolled **design tokens** (`tokens.css`) + small component CSS files. Zero runtime cost, no library lock-in, and the "mini design system" requirement is met literally: tokens → components → screens.
- **Data flow:** `MSW handlers → api client → TanStack Query (polling + optimistic mutations) → presentational components`. Types live in `src/types.ts` and are shared end-to-end.

## Deliberate product decisions (see UX_NOTES.md for the full reasoning)

1. **The PM's 14-field table request is declined in its literal form.** Four columns stay on the board (position, name, status, wait); everything else is one click away in the detail panel, plus a user-configurable column picker. Rationale and trade-offs in `UX_NOTES.md`.
2. **Wait time is computed live from `checkedInAt`**, never stored — a stored `waitMins` goes stale between polls and lies to staff.
3. **Long waits escalate in three levels** (ok → long ≥20 min → stale ≥40 min) across summary strip and rows, always with icon + text, never color alone.

## Testing

- `tests/wait.test.ts` — wait math and thresholds
- `tests/stats.test.ts` — summary statistics (waiting-only counting, avg, longest)
- `tests/stability.test.ts` — render-order stability (FIFO, called-first, tie handling)

Run with `npm test`. The MSW node server backs the component tests with the same handlers the browser uses.

## Deployment (Vercel)

The app is a standard Vite SPA
```bash
https://clinic-dashboard-zeta-liart.vercel.app/
```

## Repo map

```
src/
  app/            application shell + queue feature (board, table, panel, hooks, toasts)
  components/     mini design system (7 components + stories)
  lib/            api client, constants, wait/stats/stability helpers
  mocks/          MSW handlers + seeded data
  styles/         tokens.css (design tokens), global.css, toolbar.css
tests/            vitest unit tests + MSW node setup
.storybook/       Storybook config (a11y addon enabled)
```
