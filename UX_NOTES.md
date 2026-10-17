# UX Notes — Queue Operations Console

This document outlines the user experience (UX) rationale, design decisions, trade-offs, and accessibility implementations for the Queue Operations Console.

---

## 1. User Persona & Real-World Operating Context

The primary users of this application are **clinic front-desk staff**. 

Operating in a clinic environment introduces specific physical and cognitive constraints that shaped every design choice:

* **Constant Interruptions:** Staff are continually interrupted by incoming patients, phone calls, and doctors. They cannot maintain prolonged focus on a single screen.
* **Standing & Moving:** Staff frequently stand behind a tall counter or use a portable tablet. They do not interact with the screen with the precision of a seated desk worker with a mouse.
* **Split Attention:** Staff are often talking face-to-face with a patient while operating the software.
* **Fast-Paced Decision Making:** Staff need to make immediate decisions: *Who is next in line? Has anyone been waiting dangerously long? What action should I take right now?*

### Core UX Principles Derived From This Context:

1. **At-a-Glance Clarity (Glanceability):**  
   A staff member looking back at the screen for only 2 seconds must immediately understand the current state without scanning complex layouts or reading paragraphs. Secondary details stay tucked behind a single click.
2. **Generous Touch Targets:**  
   Because standing users tap less accurately, all primary interactive elements have comfortable touch areas. The primary "Call Next" action uses an expanded touch target (`--touch-target: 44px`), and table row action buttons remain at least `32px` with ample hit padding.
3. **Interruption-Safe Feedback:**  
   If a staff member glances away mid-action, the interface must remain clear and truthful when they look back:
   - In-flight network actions show clear loading spinners.
   - Successful actions confirm with brief toast notifications.
   - Failed actions automatically revert changes on screen with an explanatory message.
   - Nothing fails silently or leaves the user guessing.
4. **Context Preservation:**  
   Opening detailed information about one patient must never obscure or navigate away from the broader waiting queue. Staff constantly need to compare an individual against the entire room.

---

## 2. Key Design Decisions & Technical Trade-offs

### Decision 1: Customer Details in a Side Drawer (Not a Modal or New Page)

When a staff member clicks a customer's name, their full profile opens in a **slide-out side drawer** rather than navigating to a new URL route (`/customers/:id`) or popping up a centered modal dialog.

* **On Desktop screens (≥ 900px wide):** The layout splits into a side-by-side view. The queue table remains fully visible and active on the left, while the customer profile appears on the right.
* **On Tablet portrait screens (< 900px wide):** The drawer slides smoothly over the board with an accessible backdrop.

#### Benefits:
* **Zero loss of context:** Staff can review a patient's notes or reassign them to another queue while still keeping an eye on the waiting room.
* **Preserved state:** Navigating to a separate page route would unmount the live queue board, reset table scroll position, and re-trigger initial network requests. The drawer avoids all of this.

#### Trade-offs & Alternatives:
* **Screen width:** On compact screens (like a 10" tablet in portrait mode), a side drawer covers most of the table. We accepted this trade-off because reading deep profile notes is a brief, focused task. Pressing `Escape` or tapping the close button instantly restores the full table view.
* **Why not a modal?** A centered modal dialog blocks the entire background with an overlay, breaking the staff member's view of the queue.

---

### Decision 2: Instant "Optimistic" Updates for All Actions

When staff click **Call Next**, **Mark Served**, **Mark No-Show**, or **Move Queue**, the UI updates **instantly** without waiting for the server to reply. In the background, the request is sent to the server. If the request succeeds, a subtle toast confirms it; if it fails, the UI rolls back the change automatically.

#### Benefits:
* **Natural speed:** Front-desk interactions happen at conversational speed. If a button takes 500–900 ms to respond under network latency, staff often think their tap didn't register and tap it a second time. Accidental double-taps can cause duplicate actions and corrupted queue order. Instant feedback eliminates this problem.

#### Trade-offs & Technical Complexity:
* **Rollback logic:** Optimistic updates require significantly more code than standard requests. Each action must save a snapshot of the queue state before modifying it, handle cache patching, and cleanly roll back both the source and destination queues if an error occurs.
* **Why not wait for the server (pessimistic update)?** Waiting for the network makes the app feel sluggish and unresponsive in a busy clinic.

---

### Decision 3: Wait Times Calculated Live on the Client

Instead of relying on a static wait time number sent by the backend (e.g. `waitMins: 14`), the application takes the patient's arrival timestamp (`checkedInAt: "2026-10-17T11:30:00Z"`) and calculates elapsed minutes locally using a client-side clock timer that ticks every 30 seconds.

#### Benefits:
* **Accurate and truthful:** Wait times continue to tick upward smoothly even between network polling intervals.
* **Consistency:** The summary bar at the top of the screen ("Longest wait: 42 min") and the individual row badges ("42 min") are always in sync because they read from the exact same clock tick.
* **Reduced server load:** The backend does not have to recalculate wait minutes for dozens of rows on every single poll request.

#### Trade-offs & Performance:
* Updating the time every 30 seconds triggers a re-render. To ensure this does not hurt performance, individual table rows are wrapped in `React.memo()`. Only the specific wait-time badge cells update, keeping CPU usage negligible even with large queues.

---

## 3. Resolving the 14-Field Table Request

### The Request:
The Product Manager initially requested displaying all 14 customer fields (name, phone, email, date of birth, visit reason, notes, ticket number, language, check-in time, staff creator, and more) directly inside the queue table so staff "never have to click."

### Why Cramming 14 Columns Hurts the User:
On a standard clinic monitor (1280px wide), fitting 14 columns gives each column roughly 80 to 90 pixels of width:
1. **Severe text truncation:** Phone numbers, email addresses, and visit reasons get cut off with ellipses (`...`). Staff end up looking at partial data, which leads to reading errors while speaking on the phone.
2. **Forced horizontal scrolling:** If columns aren't truncated, the table forces horizontal scrollbars. This hides the action buttons ("Call Next", "Serve") off the right edge of the screen, forcing staff to scroll back and forth for every single customer.
3. **Cognitive overload:** A dense wall of data destroys glanceability. It becomes harder to spot high-priority items like patients waiting over 30 minutes.

### The Solution Implemented:
We balanced the underlying user need with practical usability:

1. **High-Priority Defaults (6 Columns):**  
   The default table displays only the 6 fields necessary to decide the *next immediate action*: **Position**, **Name**, **Status**, **Wait Time**, **Visit Reason**, and **Action Buttons**.
2. **Configurable Column Picker:**  
   Staff can customize their view. A dropdown allows them to toggle additional columns (phone, email, notes, ticket number, etc.) on or off based on their clinic desk's specific workflow.
3. **One-Click Comprehensive Drawer:**  
   Clicking any row opens the side drawer, displaying all 14 fields in a clean, legible card layout with click-to-call phone links and email shortcuts.

> **Summary:** The real goal behind "never have to click" is making sure critical information is never out of reach. By displaying decision fields at 0 clicks and full profile details at 1 click, staff get both speed and clarity without a cluttered screen.

---

## 4. Priority Area for User Testing: The "Move Queue" Flow

If given the opportunity to conduct quick user testing (such as a 5-person think-aloud session), the highest-priority area to test is the **"Move to another queue"** interaction.

### Why This Feature Has Usability Risks:
* **Row disappearance:** When a patient is moved to another queue (e.g., from "General Intake" to "Triage"), their row vanishes from the current table.
* **Low confirmation visibility:** Aside from a brief toast notification, there is no visual confirmation of where the patient landed unless the staff member manually switches queues.
* **Accidental errors:** In a noisy, fast-paced environment, staff could accidentally select the wrong destination queue and not notice immediately.

### Recommended Safeguards to Prototype:
1. **Instant Undo Button:** Include an "Undo" action directly inside the confirmation toast notification so accidental moves can be reverted in one click.
2. **Visual Destination Confirmation:** If the destination queue is open or visible, briefly flash/highlight the newly moved patient's row so staff see that the transfer was successful.

---

## 5. Verified Accessibility Features (a11y)

The console was built to meet WCAG 2.1 Level AA standards and was tested for keyboard navigation, visual readability, and screen reader compatibility:

* **Complete Keyboard Operability:**  
  Staff can operate the entire dashboard without a mouse:
  - A hidden "Skip to main content" link appears on the first `Tab` press.
  - Logical tab order traverses through queue selection, column toggles, "Call Next", and row action menus.
  - The customer detail drawer features an active **focus trap** (focus cannot accidentally escape behind the drawer) and closes cleanly when pressing the `Escape` key, returning keyboard focus directly to the button that opened it.
* **Visible Focus Indicators:**  
  Every interactive element (buttons, dropdowns, table cells) features a high-contrast `:focus-visible` outline ring that is clearly distinguishable.
* **Information Beyond Color:**  
  Long wait times are never communicated by color alone. High-severity waits use a combination of:
  - Distinct badge background tokens.
  - A visible warning icon (`⚠` or `⏰`).
  - Clear text labels (e.g. `34 min — long wait`).
  - Screen-reader text announcements (`.sr-only`).
* **Live Screen Reader Announcements:**  
  - Dynamic toast alerts use an `aria-live="assertive"` region so staff using assistive technology hear operational updates immediately.
  - The summary status card uses `aria-live="polite"` so changes in queue counts or wait escalations are announced without interrupting ongoing speech.
* **Strict Contrast Ratios:**  
  All text and interactive borders meet or exceed WCAG AA minimum contrast standards:
  - Primary text (`#101828`) on white background: **~16:1** (requirement: 4.5:1).
  - Secondary text (`#667085`) on white background: **~5.6:1** (requirement: 4.5:1).
  - Badges and buttons maintain compliant foreground-to-background contrast across all visual themes.
* **Reduced Motion Support:**  
  All animated transitions (drawer slide-in, toast pop-ups, arrival highlights, and skeleton shimmer effects) automatically disable when the user has `prefers-reduced-motion: reduce` enabled in their operating system settings.
