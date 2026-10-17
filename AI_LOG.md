# AI_LOG.md — Working with AI on This Assessment

This document details how AI assistance was utilized throughout this technical assessment: the specific tools used, the senior-level prompts that directed the work, real-world failure modes where AI output required manual correction, and a direct before-and-after comparison of an AI-generated component versus its production-ready version.

---

## 1. Tools & Engineering Workflow

| Tool | Role & Practical Application |
|---|---|
| **Codebuff (Claude-class AI Agent)** | Accelerated initial drafting, code scaffolding, tests, Storybook stories, and preliminary documentation. Directed step-by-step with explicit architectural requirements. |
| **Real Browser Testing (Chrome & Tablet Viewport)** | Manually testing every user interaction: calling next, serving patients, moving queues, simulated network drops, and window resizing. This was where runtime bugs and edge cases were discovered. |
| **Automated Verification (TypeScript, Vitest, ESLint)** | Acting as an immediate quality gate after every code change. Code was never accepted simply because it looked plausible; it had to pass strict type-checking, linting, and automated tests. |

> **Core Philosophy:** **AI drafts, the engineer verifies.** Code that compiles without TypeScript errors can still fail in production. Every bug documented below passed `tsc --noEmit` cleanly but failed when tested under real runtime conditions.

---

## 2. Step-by-Step Implementation Process

Rather than asking AI to generate the application with one giant prompt, the project was broken down into small, verifiable milestones: **Prompt ➔ Review Code Diff ➔ Typecheck & Test ➔ Validate in Browser ➔ Refine.**

1. **Requirements Checklist:** Translated the assessment brief into a structured checklist covering functional features, engineering criteria, accessibility mandates, and deliverables.
2. **Project Scaffolding:** Set up Vite with React, strict TypeScript, Vitest, MSW (Mock Service Worker), and TanStack Query.
3. **Realistic Mock Server First:** Configured MSW with network latency (350–900ms) and a ~10% simulated failure rate from day one, forcing the UI to handle errors and loading states immediately.
4. **Queue Operations & Optimistic UI:** Implemented the queue board and the four primary actions (Call Next, Serve, No-Show, Move), building optimistic updates and automatic rollbacks from the start.
5. **Real-Time Polling & Visual Stability:** Set up 5-second polling and ensured newly arrived patients did not cause the table to shift or jump under the user's cursor.
6. **Design System & Tokens:** Defined central CSS design tokens, followed by 8 accessible UI components and Storybook stories.
7. **Accessibility (a11y) Pass:** Built a complete keyboard navigation flow, focus-trapping drawer, screen-reader live regions (`aria-live`), and verified contrast ratios.
8. **Responsive Testing:** Tested layouts across desktop and tablet portrait breakpoints (1100px, 900px, and 768px) in a real browser.
9. **Documentation:** Authored comprehensive architectural guides (`README.md`, `UX_NOTES.md`, `ASSUMPTIONS.md`, `REVIEW.md`, and this `AI_LOG.md`).
10. **Final Verification:** Ensured clean builds across `npm run typecheck`, `npm test`, and `npm run build:app`.

---

## 3. Key Prompts (Verbatim)

Below are the key prompts used to direct the AI. They reflect how a Senior Software Engineer structures requirements: setting clear constraints, defining error handling, and debugging runtime behavior with specific technical hypotheses.

> **1. Initial Scoping & Planning:**  
> *"Analyze `Frontend_Lead_Assessment.pdf` and extract all explicit requirements, architectural constraints, and UX expectations. Generate a structured implementation plan and checklist mapping functional requirements (queue board, optimistic actions, drawer), engineering criteria (MSW, error states, a11y), and deliverables (Part A code, Part B review, architecture docs)."*

> **2. Mock API & Network Resilience:**  
> *"Configure MSW v2 to intercept queue endpoints (`/api/locations/:id/queue`). Simulate realistic network conditions with 350–900ms jitter and a configurable ~10% failure rate. Ensure deterministic testing via custom request headers (`x-force-failure`, `x-force-success`). Scaffold the React UI state machine covering idle, loading skeleton, empty queue, and error states with an actionable retry mechanism."*

> **3. Real-Time Synchronization & UX Stability:**  
> *"Implement a 5-second polling strategy using TanStack Query, pausing automatically when the document is hidden (`refetchIntervalInBackground: false`). To ensure visual stability under cursor/touch, decouple server arrival order from DOM positioning: sort stably by check-in timestamp and wrap row items in `React.memo` with persistent keys so newly polled arrivals append cleanly without shifting existing elements."*

> **4. Enforcing Accessibility (a11y):**  
> *"Audit and enforce WCAG 2.1 AA compliance: establish a global `:focus-visible` ring across all interactive controls, implement a skip link, and ensure the customer detail drawer traps focus and restores it on `Escape`. Replace all color-only severity indicators with design-token badges combining color, warning icons (`⚠`), and screen-reader text (`.sr-only`). Ensure all live notifications use `aria-live` regions."*

> **5. Debugging MSW Route Collisions:**  
> *"Debugging `/move` mutation failure: POST requests to `/api/queues/:queueId/customers/:customerId/move` are returning 400 'Unsupported action: move'. Inspect `src/mocks/handlers.ts`. It appears the parameterized generic route handler `/:action` is declared before the explicit `/move` route and intercepting it. Refactor handler registration order so specific routes precede parameterized wildcards."*

> **6. Debugging 3D Canvas Viewport Clipping:**  
> *"The 3D canvas visualization is clipping the model's apex during its heartbeat scale animation. The canvas viewport bounds and camera FOV do not provide sufficient headroom for the vertex displacement. Adjust camera distance from z: 9 to z: 11 (or recalculate projection frustum) and ensure the container preserves aspect ratio without CSS overflow truncation."*

> **7. Debugging Responsive Breakpoint Conflicts:**  
> *"Responsive breakpoint conflict in `QueueTable`: On tablet portrait (≤900px), selecting a column in the column-picker updates state, but the column remains hidden. Inspect CSS media queries: an unconditional `@media (max-width: 900px)` is hiding columns with `display: none !important`. Decouple layout defaults from user preference: let explicitly selected columns override the responsive default hide rule."*

The last three prompts demonstrate real-world engineering verification: finding issues by actively running and using the application rather than relying solely on static code review.

---

## 4. Key Areas Where AI Output Required Correction

While the AI generated clean-looking code that passed TypeScript compilation, several edge cases required human intervention and architectural corrections:

### 1. MSW Route Order Collision
- **Problem:** Clicking "Move to another queue" failed with a 400 error: `"Unsupported action: move"`.
- **Root Cause:** In `src/mocks/handlers.ts`, a generic wildcard route (`/api/queues/:queueId/:action`) was defined before the specific `/move` route. MSW matched the generic route first and treated "move" as an invalid action.
- **Fix:** Reordered route declarations so specific endpoints (`/move`) are evaluated before parameterized wildcards.

### 2. Incomplete Mutation Rollback in `callNext`
- **Problem:** When an error occurred while calling a patient, an error toast appeared, but the table still showed the patient as "called".
- **Root Cause:** The optimistic update changed local state, but the `onError` callback failed to restore the previous cache snapshot.
- **Fix:** Captured a snapshot in `onMutate` and explicitly passed it to `patch(previous)` inside the `onError` handler.

### 3. Invalid React Hook Placement
- **Problem:** An early draft created a helper function `makeLeaveMutation()` that called `useMutation` inside a regular utility function.
- **Root Cause:** Calling React hooks inside nested plain functions violates the Rules of Hooks and causes unpredictable behavior if execution order changes.
- **Fix:** Converted the function into a custom React hook (`useLeaveMutation`) called at the top level of the component.

### 4. Overwriting Optimistic Cache with Stale Data on Success
- **Problem:** Successfully marking a patient as "Served" caused the row to briefly reappear before disappearing again on the next poll.
- **Root Cause:** The `onSuccess` callback was accidentally writing back the pre-mutation snapshot instead of applying the server's updated response.
- **Fix:** Updated `onSuccess` to trust and apply the server response (`patch(data)`).

### 5. Inconsistent Mock Wait Times
- **Problem:** Newly generated mock customers had completely random wait times, causing position #3 in line to have a longer wait time than position #1.
- **Root Cause:** The mock generator created random numbers without considering First-In, First-Out (FIFO) queue logic.
- **Fix:** Recalibrated mock data generation so wait times decrease logically as position numbers increase.

### 6. 3D Model Viewport Clipping
- **Problem:** The animated 3D heart was getting cut off at the bottom of the card during its pulsing animation.
- **Root Cause:** The 3D camera was positioned too close (`z: 9`), leaving no headroom for the model's scale expansion during animation peaks.
- **Fix:** Moved the camera back (`z: 11`) and recalculated stage height to ensure complete visibility throughout the animation cycle.

### 7. Canvas Overflow Causing Horizontal Scroll on Window Resize
- **Problem:** Rotating or resizing a tablet screen caused the WebGL canvas to overflow its container, forcing an unwanted horizontal scrollbar across the whole page.
- **Root Cause:** The resize handler allowed Three.js's `renderer.setSize` to dictate the DOM element's display style directly.
- **Fix:** Disabled automatic style overrides (`updateStyle: false`) and controlled the canvas dimensions purely through responsive CSS (`width: 100%`).

### 8. Tablet Column Filter Conflict
- **Problem:** Checking an optional column (e.g. "Phone") on a tablet updated the checkbox, but the column remained invisible.
- **Root Cause:** A CSS media query unconditionally hid the column on small screens using `display: none !important`, overriding the user's manual selection.
- **Fix:** Tracked user-selected columns in state and allowed explicit user choices to override default responsive hiding rules.

---

## 5. Code Comparison: Raw AI Draft vs. Final Production Code

The implementation of the **queue action hook** highlights the difference between initial AI-generated code and production-ready engineering.

### Raw AI Output (Initial Draft)

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

### Final Production Version (`src/app/use-queue-actions.ts`)

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
      // 1. Cancel outgoing queries so background polling doesn't overwrite optimistic state
      await qc.cancelQueries({ queryKey: queueKeys.one(queueId) });

      // 2. Take a snapshot of current data for rollback
      const previous = qc.getQueryData<QueueSnapshot>(queueKeys.one(queueId));
      if (!previous) return { previous: undefined, name: "Customer" };

      // 3. Optimistically remove customer and recalculate remaining positions
      qc.setQueryData<QueueSnapshot>(
        queueKeys.one(queueId),
        removeFromSnapshot(previous, customerId)
      );

      return { previous, name: nameOf(customerId, [previous]) };
    },
    onError: (_err, _customerId, ctx) => {
      // 4. Rollback to snapshot and show an actionable error message
      if (ctx?.previous) patch(ctx.previous);
      push("error", `${ctx?.name ?? "Customer"}: ${messages.error}${ROLLBACK_SUFFIX}`);
    },
    onSuccess: (data, _customerId, ctx) => {
      // 5. Update state from authoritative server response
      patch(data);
      push("success", `${ctx?.name ?? "Customer"}: ${messages.success}`);
    },
    onSettled: () => {
      // 6. Invalidate query to ensure full server sync
      void qc.invalidateQueries({ queryKey: queueKeys.one(queueId) });
    },
  });

const serve = useLeaveMutation("serve", {
  success: "marked as served.",
  error: "could not mark served.",
});
```

### Why These Changes Were Necessary:

1. **Preventing Network Race Conditions:** Added `await qc.cancelQueries(...)`. Without this, an in-flight background poll could resolve right after an optimistic update and overwrite the change, causing the patient to flash back onto the screen.
2. **Authoritative Server Sync:** Updated `onSuccess` to use the server's confirmed response (`patch(data)`), ensuring multi-desk actions from other staff members are reflected.
3. **Actionable Feedback:** Replaced generic `"Something went wrong"` with specific, personalized messages naming the patient and stating that changes were rolled back (e.g. *"Grace Vogel: could not mark served. Change was rolled back, please retry"*).
4. **Queue Position Recalculation:** Used a helper (`removeFromSnapshot`) that recalculates sequential position numbers (`1, 2, 3...`) instead of leaving numerical gaps in the queue.
5. **Robust Rollback Context:** Returned `{ previous, name }` context objects rather than relying on outer closure variables, preventing race conditions if multiple mutations occur in rapid succession.

---

## 6. Key Takeaways on AI-Assisted Development

* **AI Accelerates Boilerplate, Not Architecture:** AI excels at generating standard repetitive code, types, and baseline component structure. However, system architecture, state-synchronization strategies, and edge-case handling still require human direction.
* **Compilation is Not Verification:** Clean TypeScript compilation only guarantees syntactic validity. It does not prevent runtime race conditions, accessibility failures, or visual clipping.
* **The Importance of Hands-On Testing:** The most effective way to catch AI bugs is manual interaction in a real browser under varying viewport sizes and network conditions.
