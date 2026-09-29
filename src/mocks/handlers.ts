import { HttpResponse, delay, http } from "msw";
import type { Customer, QueueActionResponse, QueueId, QueueSnapshot } from "@/types";
import { QUEUE_IDS } from "@/lib/constants";
import { seedAllQueues } from "./data";

/**
 * In-memory "server" state. Survives across requests within a session,
 * resets on page reload. Enough to exercise optimistic flows.
 */
const db: Record<QueueId, QueueSnapshot> = seedAllQueues();

const LATENCY_MIN = 350;
const LATENCY_MAX = 900;
const FAILURE_RATE = 0.1; // ~10% random failures, per the brief

function jitteredDelay(): Promise<void> {
  const ms = LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
  return delay(ms);
}

/**
 * Roll the ~10% failure dice. The UI can opt out of randomness with
 * `x-force-failure: 1` (always fail) or `x-force-success: 1` (never fail)
 * so tests and demos can exercise both paths deterministically.
 */
function shouldFail(request: Request): boolean {
  if (request.headers.get("x-force-failure") === "1") return true;
  if (request.headers.get("x-force-success") === "1") return false;
  return Math.random() < FAILURE_RATE;
}

function failure() {
  return HttpResponse.json(
    { ok: false, error: "The queue service is temporarily unavailable. Please retry." },
    { status: 503 }
  );
}

function snapshot(queueId: QueueId): QueueSnapshot {
  return { queueId, updatedAt: new Date().toISOString(), customers: db[queueId].customers.map((c) => ({ ...c })) };
}

function okQueue(queueId: QueueId) {
  return HttpResponse.json<QueueActionResponse>({ ok: true, queue: snapshot(queueId) });
}

function findCustomer(id: string): { queueId: QueueId; customer: Customer; index: number } | null {
  for (const queueId of QUEUE_IDS) {
    const index = db[queueId].customers.findIndex((c) => c.id === id);
    if (index >= 0) return { queueId, customer: db[queueId].customers[index], index };
  }
  return null;
}

function renumber(queueId: QueueId) {
  db[queueId].customers.forEach((c, i) => {
    c.position = i + 1;
  });
}

/** Periodic simulated activity: walk-ins arrive at random intervals. */
function scheduleArrivals() {
  const next = 12_000 + Math.random() * 15_000; // every 12–27s
  setTimeout(() => {
    const queueId = QUEUE_IDS[Math.floor(Math.random() * QUEUE_IDS.length)];
    db[queueId].customers.push({
      id: `c-${Date.now()}`,
      name: `Walk-in ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      position: db[queueId].customers.length + 1,
      status: "waiting",
      waitMins: 0,
      checkedInAt: new Date().toISOString(),
      phone: "(+1) 555-0000",
      email: "walkin@example.com",
      visitReason: "Walk-in",
      notes: "",
      createdBy: "Kiosk",
      ticketNumber: `W${Math.floor(Math.random() * 900) + 100}`,
      dateOfBirth: "1990-01-01",
      language: "English",
    });
    renumber(queueId);
    scheduleArrivals();
  }, next);
}
scheduleArrivals();

export const handlers = [
  /** GET snapshot for one queue. */
  http.get("/api/locations/1/queue/:queueId", async ({ request, params }) => {
    await jitteredDelay();
    const queueId = params.queueId as QueueId;
    if (!QUEUE_IDS.includes(queueId)) {
      return HttpResponse.json({ ok: false, error: "Unknown queue" }, { status: 404 });
    }
    if (shouldFail(request)) return failure();
    return HttpResponse.json<QueueSnapshot>(snapshot(queueId));
  }),

  /** POST call-next: first waiting customer becomes "called". */
  http.post("/api/locations/1/queue/:queueId/call-next", async ({ request, params }) => {
    await jitteredDelay();
    if (shouldFail(request)) return failure();
    const queueId = params.queueId as QueueId;
    if (!QUEUE_IDS.includes(queueId)) return failure();
    const head = db[queueId].customers.find((c) => c.status === "waiting");
    if (!head) return failure();
    head.status = "called";
    return okQueue(queueId);
  }),

  /**
   * POST move: transfer a customer to another queue (?to=), appending at the back.
   * NOTE: declared before the generic :action route below, otherwise "/move"
   * would be captured by it and rejected.
   */
  http.post("/api/locations/1/queue/:queueId/customers/:customerId/move", async ({ request, params }) => {
    await jitteredDelay();
    if (shouldFail(request)) return failure();
    const queueId = params.queueId as QueueId;
    const customerId = params.customerId as string;
    const targetQueueId = new URL(request.url).searchParams.get("to") as QueueId | null;

    if (!targetQueueId || !QUEUE_IDS.includes(targetQueueId) || targetQueueId === queueId) {
      return failure();
    }

    const found = findCustomer(customerId);
    if (!found || found.queueId !== queueId) return failure();

    db[queueId].customers = db[queueId].customers.filter((c) => c.id !== customerId);
    renumber(queueId);

    db[targetQueueId].customers.push(found.customer);
    renumber(targetQueueId);

    return HttpResponse.json<{ ok: true; from: QueueSnapshot; to: QueueSnapshot }>({
      ok: true,
      from: snapshot(queueId),
      to: snapshot(targetQueueId),
    });
  }),

  /** POST serve / no-show: terminal transitions that remove the customer from the board. */
  http.post("/api/locations/1/queue/:queueId/customers/:customerId/:action", async ({ request, params }) => {
    await jitteredDelay();
    if (shouldFail(request)) return failure();
    const queueId = params.queueId as QueueId;
    const customerId = params.customerId as string;
    const action = params.action as string;

    const found = findCustomer(customerId);
    if (!found || found.queueId !== queueId) return failure();

    if (action === "serve" || action === "no-show") {
      found.customer.status = action === "serve" ? "served" : "no_show";
      db[queueId].customers = db[queueId].customers.filter((c) => c.id !== customerId);
      renumber(queueId);
      return okQueue(queueId);
    }

    return HttpResponse.json({ ok: false, error: `Unsupported action: ${action}` }, { status: 400 });
  }),
];
