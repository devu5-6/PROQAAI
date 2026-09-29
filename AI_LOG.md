# AI_LOG.md — How AI was used in this assessment

The brief expects AI use and asks for honesty about it: which tools, key prompts, and one component shown as **raw AI output vs final version** with an explanation of the changes.

## Tools used

| Tool | Used for |
|---|---|
| **Codebuff (Buffy agent, Claude-class model)** | The whole submission was built by directing an AI coding agent: scaffolding, all source files, tests, Storybook, and these docs. I worked prompt-by-prompt, reading every file it produced and steering corrections (examples below). |
| Browser preview + DOM evaluation | Verifying AI-written behavior for real: click paths, toasts, rollback, Escape handling — this is where several AI bugs were caught (see "Corrected work" below). |

## How I directed the work

Rather than one mega-prompt ("build me a queue app"), the assessment was driven as a sequence of intent-level prompts, each followed by verification:

1. *"Decode the PDF brief and list every submission requirement."* — established the checklist the work was tracked against.
2. *"Scaffold Vite + React + TS with MSW, TanStack Query, strict TS, Vitest."*
3. *"Implement the queue board with optimistic actions and rollback; the list must not jump when new arrivals appear."*
4. *"Add accessibility: focus trap drawer, aria-live toasts, no color-only signals."*
5. *"Verify in a real browser: call next, serve, no-show, move, failure path."* — caught the route-collision and rollback bugs.
6. *"Write UX_NOTES / AI_LOG / ASSUMPTIONS / REVIEW per the brief's exact deliverable list."*

At each step the loop was: **direct → read the diff → run typecheck/tests → verify behavior in the browser → correct**. The PDF's point — assessing how well you direct, verify, and correct AI output — is exactly the loop below.

## Key prompts (verbatim)

> "complete assignment as per the Frontend_Lead_Assessment.pdf — first go through the pdf and satisfy all the points they want us to complete for the submission of assignment"

> "Mock API with MSW including latency and roughly a 10% random failure rate. The UI must handle loading, empty, error, and retry states properly. Optimistic updates for actions, with rollback and clear feedback when the server rejects them."

> "Real-time updates: use polling. New arrivals must not make the list jump under the user's cursor or finger."

> "The console must be fully keyboard-operable, with visible focus, sufficient contrast, and no information conveyed by color alone."

> "Move isn't working — every move fails with 'Unsupported action'. Investigate." *(led to the handler-order fix below)*

## Where AI output needed correction (the honest part)

1. **Route collision in my MSW handlers.** The generic `:action` route was declared before the `/move` route, so every move was captured and rejected with `Unsupported action: move`. Found only by clicking the real UI; fixed by declaring the specific route first.
2. **Missing rollback in `callNext`.** First version showed the error toast but never restored the cached snapshot — the queue stayed wrong after a rejected call-next. Caught on re-read of the diff; fixed by restoring the `previous` snapshot in `onError`.
3. **A fake "hook factory".** The first hooks draft defined `makeLeaveMutation()` calling `useMutation` inside a plain function — a rules-of-hooks violation that *happened* to work because it always ran in the same order. Rewritten as three explicit `useMutation` calls.
4. **Serve/no-show success handler patched the wrong snapshot** (restored the *pre-mutation* cache on success, undoing the optimistic update visually until the next poll).
5. **Un-realistic mock data** — wait times were random per customer, so position #3 had waited longer than #1. Re-seeded so wait time decreases with position (FIFO-coherent).
6. **Numerous tool-transport glitches** (corrupted file writes) that produced silently broken files; caught by re-reading every file after writing it.

The lesson AI keeps teaching: generated code that typechecks is not generated code that works. Every defect above passed `tsc --noEmit`.

## Component: raw AI output vs final version

The most instructive before/after is the optimistic action hook, because the raw version contains the two classic AI failure modes: plausible-but-wrong state handling and invisible coupling.

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
const makeLeaveMutation = (
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

const serve = makeLeaveMutation("serve", {
  success: "marked as served.",
  error: "could not mark served.",
});
```

### What I changed and why

1. **`await qc.cancelQueries(...)` added to `onMutate`.** Without it, an in-flight 5-second poll resolves *after* the optimistic patch and overwrites it — the served row visually pops back for one interval. Classic TanStack Query race; the raw version had it.
2. **Server snapshot wins on success (`patch(data)`), not the optimistic one.** The raw draft never trusted the server response, so any server-side reordering (another desk acting concurrently) was silently discarded until the next poll.
3. **Real rollback + human message.** Raw: `context.previous` restored but the toast said "Something went wrong" — useless mid-conversation. Final: the customer's *name*, what failed, and that the change was rolled back, e.g. *"Grace Vogel: could not mark served. Change was rolled back — please retry."* A staffer must know **what** to retry.
4. **Shared `removeFromSnapshot` renumbers positions.** The raw filter left `position` values with a hole (1,2,4…), contradicting the "#1 is next" mental model everywhere else in the UI.
5. **Structured mutation context (`{ previous, name }`)** instead of relying on closure captures — keeps rollback correct even if two mutations race.
6. **No fake hook factory.** An earlier AI draft invoked `useMutation` inside a plain helper function; legal-looking, but a rules-of-hooks violation waiting for the first conditional. The final shape calls `useMutation` unconditionally at hook top level.

(The Part B PR review — where these same instincts are applied to an unfamiliar component — is in `REVIEW.md`.)
