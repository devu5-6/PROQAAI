# ASSUMPTIONS.md — Every ambiguity and how I resolved it

The brief leaves a number of things open. Each ambiguity below is listed with the assumption I chose, and what I'd confirm with the real team given one more day.

## Product / scope

| # | Ambiguity | Assumption (resolution) | Would confirm |
|---|---|---|---|
| 1 | "Live queue board **for a location**" — but no location data model is given. | Hardcoded a single location (`/api/locations/1/…`). A location switcher would be trivial to add (the API paths already carry `locationId`). | How many locations exist, and does one desk ever cover several? |
| 2 | How many queues exist and what are they called? | Three: General, Vaccination, Billing. | Real queue taxonomy per location. |
| 3 | "Move a customer to another queue" — front of the target queue, or back? | Back of the target queue (FIFO fairness: they re-join at their arrival time... concretely, they are appended last and renumbered). | Business rule: re-triage on move should probably reset wait time — not modeled. |
| 4 | What happens to *served* / *no-show* customers — vanish, or history view? | They leave the board immediately (status terminal). No history view built — out of scope for a console; noted as an obvious future tab. | Whether staff ever need to undo a no-show (common in real clinics). |
| 5 | "Near real time" — polling vs WebSocket? | 5-second polling via TanStack Query (pause when tab hidden). Simulated WebSocket rejected as indistinguishable-from-polling theater at this scale; real WS is a drop-in upgrade at the `useQueueQuery` layer. | Expected update volume; whether WS infra exists. |
| 6 | The brief's mock data is unspecified. | Seeded random queue (3–9 customers each) + a simulated walk-in arrival every 12–27 s so the "no-jump" behavior is observable. | Realistic arrival/volume patterns. |
| 7 | Who may perform actions (auth/roles)? | Out of scope — no login. The console assumes a trusted, shared front-desk machine. | Whether an auth gate is required for even the demo. |

## Interaction / UX

| # | Ambiguity | Assumption (resolution) | Would confirm |
|---|---|---|---|
| 8 | "Customer detail panel that opens without losing the queue view" — drawer, split pane, or modal? | Side drawer beside the board ≥900 px; overlay below that. Rationale in UX_NOTES.md. | Tablet ergonomics on real hardware. |
| 9 | The 14-field request — literally in the table, or interpret? | Interpreted: 6 decision-driving columns + column picker + full-data drawer. Full justification in UX_NOTES.md. | With the PM directly — with telemetry plan offered. |
| 10 | Wait thresholds for "long". | ≥20 min = long (warning), ≥40 min = stale (critical). Single source of truth in `src/lib/constants.ts`. | Clinic SLA — some promise 15 min, some 30. |
| 11 | Does "call next" skip no-shows/absent customers? | Call-next marks the first *waiting* customer as *called*; they stay on the board pinned first until served/no-showed. | Whether called customers should auto-expire back to waiting after N minutes. |
| 12 | Multiple desks working the same queue simultaneously? | Modeled implicitly: every poll can bring server-side changes (other desks' actions) into any console. No locking. | Concurrency rules (two desks calling next at once). |

## Technical

| # | Ambiguity | Assumption (resolution) | Would confirm |
|---|---|---|---|
| 13 | "MSW **or something similar**" | MSW v2 (browser worker in dev/preview, node server in tests). | Company preference; if a real API exists, MSW handlers mirror its contract. |
| 14 | "Roughly 10% random failure" — which endpoints? | Applied to GET (refetch survives, retry=1) and all mutations (optimistic rollback + toast). Header overrides (`x-force-success/failure`) for deterministic tests. | Whether GETs failing 10% of the time is realistic or should be mutations-only. |
| 15 | Browser support target. | Evergreen browsers; ES2022 output; no IE11. | If the clinic runs kiosk-mode browsers on old machines. |
| 16 | State management "any approach, justify it." | TanStack Query for server state; `useState` for the three pieces of true UI state. Justified in README. | Team standards. |
| 17 | Deployment target ("deployed link is a plus"). | Static SPA build (`dist/`), Vercel/Netlify-compatible; MSW worker is committed under `public/` so the deployed demo is fully interactive. | Whether a real backend will replace mocks before review. |
| 18 | Assessment says "5–6 hours" — where did time go? | Spent, in order: data/optimistic-rollback correctness → no-jump rendering → accessibility → docs. Storybook stories were added as the "strong plus" but kept shallow (one story per component, no visual-regression harness). | If time-box were real, Storybook + part of the responsive polish would be the first cuts. |
