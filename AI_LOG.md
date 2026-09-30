# AI_LOG.md — How I used AI for this assessment

The brief expects AI use and asks for honesty about it: which tools, key prompts,
and one component shown as **raw AI output vs final version**, with what I changed and why.
That is exactly what this file covers.

---

## 1. Tools I used

| Tool | What I used it for |
|---|---|
| **Codebuff (Buffy agent, Claude-class model)** | All of the building: scaffolding, source files, tests, Storybook, docs. I directed it prompt by prompt, read every file it produced, and corrected it when it was wrong. |
| **Browser (real clicks, real resize)** | Verifying behavior the way a user would: call next, serve, no-show, move, failure paths, tablet widths, window resize. This is where most AI mistakes were caught. |
| **Terminal: typecheck, lint, tests** | A fast "is it sane" gate after every change. Nothing ships on vibes. |

My rule for the whole assessment: **AI writes, I verify.** AI output that typechecks
is not the same as AI output that works. Every bug listed below passed `tsc --noEmit`.

---

## 2. How I worked, in order

I did not write one giant prompt ("build me a queue app"). I worked in small,
verifiable steps. Each step: **prompt → read the diff → typecheck + tests → check
in the browser → correct.**

1. **Read the brief first.** I turned the PDF into a checklist of every requirement
   (functional, engineering, stakeholder request, deliverables). The checklist drove
   the order of everything after it.
2. **Scaffold.** Vite + React + TypeScript, strict mode, Vitest, MSW, TanStack Query.
   Cheap to set up, and it forces the architecture decisions early.
3. **Mock API + data layer first.** If the fake server is honest (latency, ~10%
   failures), every later feature is built against real conditions instead of a
   happy path.
4. **Queue board + the four actions.** Optimistic updates with rollback from day
   one, not bolted on later.
5. **Real-time behavior.** 5-second polling, then the "new arrivals must not jump
   under the cursor" work (stable render order, memoized rows).
6. **Design system.** Tokens first, then 8 small components with Storybook stories.
7. **Accessibility pass.** Keyboard path end to end, focus trap drawer, `aria-live`
   toasts, no color-only signals.
8. **Responsive pass.** Desktop → tablet portrait, checked at real widths
   (1100px, 900px, 768px) in a real browser — not just in DevTools screenshots.
9. **Docs.** README, UX_NOTES, ASSUMPTIONS, AI_LOG (this file), and the Part B
   review in REVIEW.md.
10. **Final verification.** Typecheck, lint, unit tests, production build — all
    green before submission.

Steps 8 and 10 are where the last three AI bugs below were found. That is not a
coincidence: resize behavior and breakpoint CSS are exactly the kind of thing AI
writes plausibly and wrong.

---

## 3. Key prompts (verbatim)

> "complete assignment as per the Frontend_Lead_Assessment.pdf — first go through the pdf and satisfy all the points they want us to complete for the submission of assignment"

> "Mock API with MSW including latency and roughly a 10% random failure rate. The UI must handle loading, empty, error, and retry states properly. Optimistic updates for actions, with rollback and clear feedback when the server rejects them."

> "Real-time updates: use polling. New arrivals must not make the list jump under the user's cursor or finger."

> "The console must be fully keyboard-operable, with visible focus, sufficient contrast, and no information conveyed by color alone."

> "Move isn't working — every move fails with 'Unsupported action'. Investigate."

> "The heart is being cut from the bottom — check and fix this."

> "In the tablet resolution when I try to add a column from the filter it does not show up that it's added."

The last three prompts are the honest part of this log: they are me reporting
failures I found by *using* the app, not by reading code.

---

## 4. Where AI output needed correction (the honest list)

Every one of these typechecked clean. None of them worked.

1. **Route collision in the MSW handlers.** The generic `:action` route was declared
   before the `/move` route, so every move was captured by the wrong handler and
   rejected with "Unsupported action: move". Found by clicking the real UI.
   Fix: declare the specific route first.

2. **Missing rollback in `callNext`.** The error toast showed, but the cached queue
   was never restored — the UI stayed wrong after a failed call. Fix: restore the
   `previous` snapshot in `onError`.

3. **A "hook factory" that was not a hook.** An early draft defined
   `makeLeaveMutation()` calling `useMutation` inside a plain function. That breaks
   the rules of hooks; it only *appeared* to work because it always ran in the same
   order. Fix: renamed to `useLeaveMutation` so it is honestly a hook, called
   unconditionally at the top level.

4. **Serve/no-show restored the wrong snapshot on success.** The success handler
   wrote the *pre-mutation* cache back, visually undoing the optimistic update
   until the next poll. Fix: trust the server response (`patch(data)`), not the
   optimistic guess.

5. **Unrealistic mock data.** Wait times were random per customer, so position #3
   had sometimes waited longer than #1. That contradicts FIFO and would make the
   "no-jump" behavior untestable. Fix: re-seeded so wait time decreases with position.

6. **The 3D heart was clipped at the bottom.** AI scaled the model to fill the
   stage, but did not check the camera: at distance 9 with a 38° field of view the
   visible height was ~6.2 world units while the model spanned 6.0 — zero headroom,
   so the heartbeat pulse pushed the apex out of frame. Fix: move the camera back
   (z 9 → 11) and only then raise the stage height. The lesson: one line of geometry
   math beats guessing at CSS.

7. **Stale canvas caused page-wide horizontal scroll.** After shrinking the window
   (tablet rotation), the WebGL canvas sometimes kept its old pixel width and
   overflowed the page. AI's `ResizeObserver`-based resize looked correct and
   usually was — "usually" is not good enough for layout. Fix: stop letting
   `renderer.setSize` own the canvas's *display* size (`updateStyle: false`) and
   size it with CSS instead. Now a missed resize tick can blur the canvas but can
   never overflow the page.

8. **Column picker silently ignored on tablet.** Columns marked "hide on tablet"
   were hidden by an unconditional CSS rule, so checking "Phone" in the filter
   updated the state (checkbox showed checked) but the column never appeared.
   The UI lied to the user. Fix: track columns the user explicitly enabled and
   let an explicit choice override the tablet auto-hide.

9. **Corrupted file writes.** Several tool-transport glitches produced silently
   broken files. Caught by re-reading every file after writing it. Un glamorous,
   but this is the verification habit the whole assessment rewards.

The pattern in 6–8 is worth naming: **all three bugs live in the gap between
"plausible code" and "observed behavior."** Reading the diff never caught them;
running the app did.

---

## 5. Component: raw AI output vs final version

The optimistic action hook is the most instructive before/after, because the raw
version contains the two classic AI failure modes: plausible-but-wrong state
handling, and invisible coupling.

### Raw AI output (first generated draft, abridged)

```tsx
const serve = useMutation({
  mutationFn: (customerId: string) => api.serve(queueId, customerId),
  onMutate: async (customerId: string) => {
    const previous = queryClient.getQueryData(["queues", queueId]);
    const snapshot = { ...previous };
    snapshot.customers = previous.customers.filter((c) => c.id !== customerId);
    queryClient.setQueryData(["queues", queueId], snapshot);
    return { previous };
  },
  onError: (err, customerId, context) => {
    queryClient.setQueryData(["queues", queueId], context.previous);
    toast.error("Something went wrong");
  },
  onSuccess: (data) => {
    queryClient.setQueryData(["queues", queueId], data);
    toast.success("Customer served");
  },
});
```

### Final version (from `src/app/use-queue-actions.ts`)

```tsx
const useLeaveMutation = (
  kind: "serve" | "no_show",
  messages: { success: string; error: string }
) =>
  useMutation({
    mutationFn: (customerId: string) =>
      kind === "serve"
        ? api.serve(queueId, customerId)
        : api.markNoShow(queueId, customerId),
    onMutate: async (customerId: string) => {
      await qc.cancelQueries({ queryKey: queueKeys.one(queueId) });
      const previous = qc.getQueryData<QueueSnapshot>(queueKeys.one(queueId));
      if (!previous) return { previous: undefined, name: "Customer" };
      qc.setQueryData<QueueSnapshot>(
        queueKeys.one(queueId),
        removeFromSnapshot(previous, customerId)
      );
      return { previous, name: nameOf(customerId, [previous]) };
    },
    onError: (_err, _customerId, ctx) => {
      if (ctx?.previous) patch(ctx.previous);
      push("error", `${ctx?.name ?? "Customer"}: ${messages.error}${ROLLBACK_SUFFIX}`);
    },
    onSuccess: (data, _customerId, ctx) => {
      patch(data);
      push("success", `${ctx?.name ?? "Customer"}: ${messages.success}`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queueKeys.one(queueId) });
    },
  });

const serve = useLeaveMutation("serve", {
  success: "marked as served.",
  error: "could not mark served.",
});
```

### What I changed, and why (in plain words)

1. **Added `await qc.cancelQueries(...)` in `onMutate`.** Without it, an in-flight
   5-second poll can land *after* the optimistic patch and overwrite it — the row
   visually pops back for one interval. A classic TanStack Query race the raw
   version had.
2. **Trust the server on success.** The raw draft never used the server response,
   so any server-side change (another desk acting at the same time) was silently
   discarded until the next poll.
3. **Made the error message useful.** "Something went wrong" is useless to a
   receptionist mid-conversation. The final toast names the customer, what failed,
   and that the change was rolled back — e.g. *"Grace Vogel: could not mark served.
   Change was rolled back, please retry."* The person needs to know **what to retry**.
4. **Kept positions consistent.** The raw `filter` left holes in `position`
   (1, 2, 4…). The shared `removeFromSnapshot` renumbers, so "#1 is next" stays true.
5. **Structured context (`{ previous, name }`) instead of closure captures**, so
   rollback stays correct even if two mutations race.
6. **Named the helper honestly as a hook** (`useLeaveMutation`) — see correction #3.

---

## 6. What this assessment taught me about working with AI

- AI is a fast junior pair programmer, not a reviewer. Direction and verification
  are still my job.
- The failure mode is never syntax — it is *unverified assumptions*: that a camera
  fits its subject, that a resize always fires, that a CSS rule and a checkbox
  agree with each other.
- The cheapest verification is a real browser and a real click. The second cheapest
  is a test. The most expensive is a user finding it — which is what the corrections
  above prevented.

*(The Part B PR review — the same instincts applied to an unfamiliar component —
is in `REVIEW.md`.)*
