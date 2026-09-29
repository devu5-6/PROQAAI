# REVIEW.md — Part B: Review of AI-Generated Code

## The component under review

```tsx
export default function QueueList({ locationId }) {
  const [entries, setEntries] = useState([]);
  useEffect(() => {
    fetch(`/api/locations/${locationId}/queue`)
      .then(r => r.json())
      .then(data => setEntries(data));

    setInterval(() => {
      fetch(`/api/locations/${locationId}/queue`)
        .then(r => r.json())
        .then(setEntries);
    }, 3000);
  }, []);

  const callNext = () => {
    entries[0].status = "called";
    setEntries(entries);
    fetch(`/api/queue/${entries[0].id}/call`, { method: "POST" });
  };

  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} style={{ color: e.waitMins > 30 ? "red" : "black" }}>
          {e.name} - {e.waitMins} min
        </div>
      ))}
      <div className="btn" onClick={callNext}>Call Next</div>
    </div>
  );
}
```

## Review comments (ordered by severity)

### 🔴 Critical 1 — Leaked interval that never stops and polls with a stale `locationId`

`setInterval` is never cleared, and the effect's dependency array is `[]` while the fetch closes over `locationId`. Consequences, in order of appearance:

- Navigate away and back (or change `locationId`): a **new interval stacks on top of the old one** — each mount polls every 3 s, forever, for the lifetime of the tab. On a busy ward with this page reused per location, that's N × every-3-seconds requests to the wrong (initial) location.
- The interval body keeps fetching `/api/locations/${initialLocationId}/queue` even after the user switches location — **the UI silently shows the wrong queue's data**.

**Fix:** return a cleanup from `useEffect` that clears the interval; include `locationId` in the dependency array so a location change resets the poll. Even better: cancel in-flight work with an `AbortController` in the same cleanup.

### 🔴 Critical 2 — `callNext` mutates state in place and is a guaranteed crash on an empty queue

```ts
entries[0].status = "called";   // mutates the objects behind React's back
setEntries(entries);            // same reference — React may skip re-render entirely
```

Two separate bugs:

1. **Broken render contract.** Mutating `entries[0]` then passing the *same array reference* to `setEntries` means React's `Object.is` bail-out can (and will) skip the re-render. The "called" status appears only when the next poll happens to repaint — confusing but survivable.
2. **Guaranteed crash.** `entries[0].status` throws `TypeError: Cannot set properties of undefined` when the queue is empty — i.e. every morning before the first check-in, and any time the last customer is served. The primary action of the component kills the page at the exact moment the queue is quiet.

**Fix:** guard the empty case; create new state (`setEntries(prev => prev.map(...))`). Never mutate state objects.

### 🔴 Critical 3 — Optimistic update with no rollback and no feedback on failure

`callNext` sets the status locally, then fires the POST and ignores its result. This *is* an optimistic update — the UI claims success before the server confirms — with every failure mode left open:

- The POST fails (10% of the time in our own mock, more in real life) → the row says "called" forever while the server never called anyone. The customer sits there; staff move on to the next; **the queue silently corrupts**.
- No pending state, no error toast, no retry. For a staff-facing ops tool this is the worst possible behavior: silent lying.

**Fix:** snapshot the previous state in the click handler, restore it in the failure path, and surface success/failure feedback (toast or inline). This is exactly the optimistic-with-rollback pattern the console's real actions use (`src/app/use-queue-actions.ts`).

### 🔴 Critical 4 — Zero error handling: any failure bricks the component silently

Neither fetch chain has a `.catch`, `r.ok` is never checked, and there is no error state. A 500 (or an HTML error page from a proxy) makes `r.json()` throw → unhandled promise rejection → `setEntries` never runs → the list shows **stale data forever with no indication anything is wrong** (or stays blank on first load, indistinguishable from "queue is empty").

**Fix:** check `res.ok`, catch errors, render a real error state with Retry. Distinguish "failed to load" from "no one waiting" — they demand opposite staff reactions.

### 🟠 High 5 — Index keys on an order-changing list

`key={i}` on a queue list whose order changes between polls (that's what queues do) makes React reuse DOM rows by position, not identity. Row content scrambles across customers, and any per-row state (focus, input, animation) transfers to the wrong person. For a component whose whole job is an ordered, mutating list, index keys are a correctness bug, not a style nit.

**Fix:** `key={e.id}` with a stable server ID.

### 🟠 High 6 — "Call Next" is a `<div onClick>`: keyboard users cannot operate this console

Not focusable, no `role`, no keyboard handler. The brief's accessibility bar ("fully keyboard-operable") fails at the primary action. Screen readers don't announce it as a button; Tab skips it; Enter does nothing.

**Fix:** a real `<button type="button">` (or the design-system `Button`). Also add `disabled` when the queue is empty, which incidentally fixes the crash in Critical 2 at the UI layer — but keep the code guard too.

### 🟠 High 7 — Wait severity conveyed by color alone, via a raw hex, below contrast AA

`style={{ color: e.waitMins > 30 ? "red" : "black" }}` fails three ways: color is the *only* signal (color-blind users get nothing); pure `#f00` on white is ~4:1, under WCAG AA for normal text; and hard-coded hex bypasses the token system the rest of the UI depends on.

**Fix:** a `WaitBadge`-style treatment — semantic token colors, plus an icon and text label ("long, over 30 min") so the signal survives grayscale, color blindness, and screen readers.

### 🟡 Medium 8 — No loading or empty state

First paint is blank until the first response lands; an empty queue is indistinguishable from "not loaded yet" and from "failed". Staff need the three states to look different at a glance. Skeleton rows and an explicit empty state fix this cheaply.

### 🟡 Medium 9 — Response races: stale responses can overwrite fresh ones

Two overlapping fetches (initial + interval tick, or fetch started before a location switch resolving after) have no ordering guarantee — an older response can land last and set stale `entries`. With 3 s polling and slow networks this *will* happen occasionally. The `AbortController` from Critical 1's fix, or ignoring responses after abort, closes it.

### 🟡 Medium 10 — `waitMins` is a stale snapshot, and the whole board re-renders per poll

The server's `waitMins` is frozen between polls — "7 min" for up to 3+ seconds even as minutes tick by, and the value is recomputed server-side for every row every poll. Compute wait client-side from `checkedInAt` on a slow tick (as the console does) so values climb truthfully between polls. (Minor here, but it was a stated design requirement for the console.)

### ⚪ Low 11 — Untyped and duplicated

`entries` is implicitly `any[]`, `locationId` is untyped (this component fails `tsc --strict` as written), and the fetch+parse logic is duplicated between the initial load and the interval body — the duplication is exactly where the two already disagree (`r.json().then(setEntries)` vs `then(data => setEntries(data))`). Extract one `loadQueue(signal)` helper; type `entries: QueueEntry[]`.

### ⚪ Low 12 — List semantics and live-region announcements are missing

A queue board is ordered, dynamic data: a `<ul>`/`<ol>` (or a table) with an `aria-live="polite"` status line lets screen-reader users hear "next: Amara Okafor, 12 min" when it changes. A flat `<div>` pile conveys none of that.

## Corrected version

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

interface QueueEntry {
  id: string;
  name: string;
  status: "waiting" | "called" | "served" | "no_show";
  checkedInAt: string; // ISO timestamp — wait is derived, not stored
}

const POLL_MS = 3000;

function formatWait(mins: number): string {
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

function waitMins(checkedInAt: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 60_000));
}

export default function QueueList({ locationId }: { locationId: string }) {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [callingNext, setCallingNext] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // --- Data loading: cancellable, error-checked, keyed to locationId. ------
  const loadQueue = useCallback(
    async (signal: AbortSignal): Promise<QueueEntry[]> => {
      const res = await fetch(`/api/locations/${locationId}/queue`, { signal });
      if (!res.ok) throw new Error(`Queue request failed (${res.status})`);
      const data = (await res.json()) as QueueEntry[];
      return data;
    },
    [locationId]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function tick() {
      try {
        const data = await loadQueue(controller.signal);
        if (!cancelled) {
          setEntries(data);
          setState("ready");
        }
      } catch (err) {
        if (!cancelled && !(err instanceof DOMException && err.name === "AbortError")) {
          setState("error");
        }
      }
    }

    void tick();
    const interval = window.setInterval(tick, POLL_MS);
    // Wait severity must stay truthful between polls.
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);

    return () => {
      cancelled = true;
      controller.abort();          // also orders out stale responses
      window.clearInterval(interval);
      window.clearInterval(clock);
    };
  }, [loadQueue]);                 // re-runs (and resets polling) when locationId changes

  // --- Optimistic call-next with rollback and feedback. --------------------
  const handleCallNext = useCallback(async () => {
    const head = entries.find((e) => e.status === "waiting");
    if (!head) return;                                     // crash guard (also disabled below)

    const previous = entries;                              // snapshot for rollback
    setEntries(entries.map((e) => (e.id === head.id ? { ...e, status: "called" } : e)));

    try {
      const res = await fetch(`/api/queue/${head.id}/call`, { method: "POST" });
      if (!res.ok) throw new Error(`Call failed (${res.status})`);
      setFeedback(`Now calling ${head.name}.`);
    } catch {
      setEntries(previous);                                // roll the lie back
      setFeedback(`Could not call ${head.name} — the change was rolled back. Please retry.`);
    }
  }, [entries]);

  const head = entries.find((e) => e.status === "waiting");

  return (
    <section aria-label="Queue list">
      {/* Feedback is announced to screen readers, visible to everyone. */}
      <p role="status" aria-live="polite">{feedback}</p>

      {state === "loading" && <p>Loading queue…</p>}

      {state === "error" && (
        <div role="alert">
          <p>We couldn't load the queue.</p>
          <button type="button" onClick={() => setState("loading")}>Retry</button>
        </div>
      )}

      {state === "ready" && entries.length === 0 && <p>No one is waiting.</p>}

      {state === "ready" && entries.length > 0 && (
        <ol>
          {entries.map((e) => {
            const mins = waitMins(e.checkedInAt, now);
            const long = mins > 30;
            return (
              <li key={e.id}>                                          {/* stable identity */}
                <strong>{e.name}</strong> —{" "}
                {/* severity = color + icon + text, via tokens; never color alone */}
                <span className={long ? "wait-pill wait-pill--long" : "wait-pill"}>
                  {long && <span aria-hidden="true">⚠ </span>}
                  {formatWait(mins)}
                  {long && <span className="sr-only"> — long wait, over 30 minutes</span>}
                </span>{" "}
                — {e.status}
              </li>
            );
          })}
        </ol>
      )}

      {/* A real button: focusable, operable by keyboard, announced by AT. */}
      <button type="button" onClick={() => void handleCallNext()} disabled={!head || callingNext}>
        Call Next
      </button>
    </section>
  );
}
```

### What the correction fixes, mapped to the review

| Review point | Fix in corrected version |
|---|---|
| C1 leaked interval / stale locationId | cleanup + `controller.abort()` + `[loadQueue]` dependency (re-polls per location) |
| C2 mutation + crash on empty | `map` to new objects; `find`-guard; button `disabled` when no waiting head |
| C3 optimistic w/o rollback | snapshot → restore on failure → explicit `role="status"` feedback naming the customer |
| C4 no error handling | `res.ok` check, try/catch, distinct `error` state with Retry |
| H5 index keys | `key={e.id}` |
| H6 div-button | real `<button>` |
| H7 color-only | token classes + ⚠ icon + sr-only text label |
| M8 states | loading / error / empty rendered distinctly |
| M9 races | `AbortController` aborts superseded requests |
| M10 stale wait | computed from `checkedInAt` on a 30 s clock tick |
| L11 types/duplication | typed props/state; single `loadQueue` used by both initial load and interval |
| L12 semantics | `<ol>` list + `aria-live` status region |

### Note on scope

In our codebase I would not hand-roll any of this: the corrected component is the pedagogical inline version of what `useQueueQuery` (polling, cancellation, states) and `useQueueActions` (optimistic + rollback + toast) already do with TanStack Query. The review above deliberately reviews the code *as submitted*, then the corrected version stays dependency-free so it can drop into the PR under review.
