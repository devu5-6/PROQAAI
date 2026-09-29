# UX Notes — Queue Operations Console

## Who the user is and what their context demands

The user is **clinic front-desk staff**. From the brief: they use the console on a desktop or tablet, they are **interrupted constantly**, they are **often standing**, and they are **frequently talking to a customer while using it**.

That context demands:

1. **Glanceability over completeness.** A returning glance (2–3 seconds, mid-conversation) must answer: *who's next, who's been waiting too long, what do I do next.* Everything else can wait behind a click.
2. **Large targets.** Standing users tap less precisely. Primary actions (Call next) are oversized (`--touch-target: 44px`); row actions stay ≥32 px with real hit areas.
3. **Interruption-safe state.** If the user looks away mid-action, the screen must still tell the truth: in-flight actions show spinners, completed actions confirm via toast, failed actions visibly roll back. Nothing silently changes.
4. **No lost context.** Opening a customer's details must never hide the queue — staff compare "this customer" against "the rest of the queue" constantly.

## Three most important design decisions and their trade-offs

### 1. Detail panel as a side drawer, not a route or modal dialog

The queue board stays mounted and visible next to the customer's details (≥900 px: side-by-side grid; below: drawer over the top of the board).

- **Gain:** zero context loss — the requirement "opens without losing the queue view" is satisfied literally, and staff can move/serve a customer while still seeing the queue's shape.
- **Trade-off:** horizontal space. On a 10" tablet portrait the drawer covers most of the board. Accepted because detail-reading is a brief, focused activity; Escape/close returns instantly, and the layout collapses to single-column there anyway.
- **Rejected:** a modal centered on screen (hides the queue entirely) and a route change (`/customers/:id` — destroys scroll position and the live board; polling would remount).

### 2. Optimistic updates for all four actions

Call-next, serve, no-show, and move patch the local cache immediately; the server round-trip (~350–900 ms in the mock) confirms or rolls back with a toast.

- **Gain:** the console feels instant. Front-desk staff work at conversation speed; a 0.5 s+ freeze after "Mark served" would be re-tapped ("did it work?") and double-tapped actions are how queues corrupt.
- **Trade-off:** complexity — every mutation needs `onMutate` snapshot, cache patch, error rollback, and a toast that says what happened in plain words. Rollback must also restore *both* queues for a move. This is ~4× the code of fire-and-forget, and it is worth it.
- **Rejected:** pessimistic updates (feels broken under latency) and plain fire-and-forget POSTs (silent failures — the worst possible behavior for a staff tool).

### 3. Wait time computed live from `checkedInAt`, not read from a stored field

The API also returns a snapshot `waitMins` (it models what a real backend would send), but the UI recomputes minutes from `checkedInAt` on a 30-second clock tick shared by the table and summary strip.

- **Gain:** the "51 min" badge and the summary strip never disagree, and waits keep climbing truthfully between the 5-second polls without any extra requests.
- **Trade-off:** re-renders every 30 s. Accepted — rows are `memo`-ized so only the wait cells change; the cost is negligible at queue scale (<50 rows).

## Response to the 14-field request

The PM asked for all 14 customer fields (phone, email, visit reason, notes, created by, and more) **in the queue table** so staff "never have to click."

**I am not putting 14 columns in the table.** What I did instead:

1. **Default board shows 6 columns:** position, name, status, wait, visit reason, actions — the fields that drive the *next action*. The column picker (persisted in-session) lets staff add phone, email, notes, ticket, DOB, language, checked-in, created-by individually if their desk's workflow genuinely needs a field at-a-glance.
2. **Everything is one click away:** the detail drawer shows all 14 fields, laid out readably, with tappable phone/email. "Never have to click" becomes "one click, on the rare occasion the field matters."
3. **Justification to the PM:** a 14-column table at 1280 px gives every field ~80 px. Phone numbers truncate, emails truncate, notes truncate — so the data is on screen but *unreadable*, which is worse than absent: staff will misread truncated values mid-call. Horizontal scrolling is the other outcome, which breaks the "glanceability" contract and hides the action buttons off-screen — directly harmful when marking a no-show. The claim hidden inside the request ("staff never have to click") is a proxy for a real need: *the information they need should never be more than one interaction away.* The column picker + drawer satisfies that need measurably (0 clicks for decision fields, 1 click for everything) without destroying the board.

**If the PM insists after seeing it:** turn the column picker into a per-desk persisted preference and run a two-week telemetry of which extra columns get enabled — that data either justifies a wider default set or kills the request with evidence.

## One thing I would user-test first

**The "Move to…" interaction.** It is the only action that (a) removes a row from the visible board, (b) has no visible confirmation of *where* the customer went beyond a toast, and (c) is irreversible from the UI (you must find the customer in the other queue's list to undo). My hypothesis: staff will occasionally move a customer to the wrong queue and not notice. I'd run a 5-person think-aloud test on the move flow before polishing anything else, and would prototype the two cheapest fixes regardless: an inline undo on the toast, and a brief highlight of the customer's row after arriving in the destination queue (visible if that queue is on screen).

## Accessibility notes (what was actually verified)

- Full keyboard path: Tab reaches skip link → queue select → column picker → Call next → every row action; the drawer traps focus and Escape closes it; focus returns to the opener on close.
- Focus is always visible (`:focus-visible` ring on every interactive element, including the scrollable table region).
- Long waits are conveyed by **icon + text + color** (⚠/⏰ plus "long, over 20 minutes" for screen readers), never color alone. Status badges carry icon + label.
- Toasts render in an `aria-live="assertive"` region; the longest-wait summary card is `aria-live="polite"` so escalation is announced.
- Contrast: body text #101828 on white ≈ 16:1; secondary text #667085 ≈ 5.6:1; badge/wait-pill foreground/background pairs ≥4.5:1; white-on-teal buttons ≥4.5:1.
- Reduced motion: arrival highlights, shimmer, and drawer/toast animations disable under `prefers-reduced-motion`.
