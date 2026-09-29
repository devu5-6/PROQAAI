import type { Customer, QueueId, QueueSnapshot } from "@/types";
import { QUEUES } from "@/lib/constants";

const FIRST_NAMES = [
  "Amara", "Liam", "Noor", "Priya", "Diego", "Sofia", "Kwame", "Mei",
  "Elias", "Hana", "Omar", "Isabel", "Jonas", "Leila", "Mateo", "Grace",
  "Tomas", "Yuki", "Aisha", "Rohan", "Elena", "Samir",
];

const LAST_NAMES = [
  "Okafor", "Bennett", "Haddad", "Sharma", "Ramos", "Marino", "Mensah", "Chen",
  "Vogel", "Sato", "Aziz", "Ferreira", "Lindqvist", "Nasser", "Alvarez", "Doyle",
  "Silva", "Tanaka", "Diallo", "Kapoor", "Petrova", "Hassan",
];

const VISIT_REASONS = [
  "Annual physical",
  "Follow-up: blood panel",
  "Flu-like symptoms",
  "Prescription refill",
  "Vaccination - influenza",
  "Vaccination - Tdap",
  "Billing dispute",
  "Insurance verification",
  "Lab results review",
  "Referral: cardiology",
  "Minor injury",
  "New patient intake",
];

const LANGUAGES = ["English", "Spanish", "Mandarin", "Arabic", "French", "ASL interpreter"];

const CREATORS = ["Front desk 1", "Front desk 2", "Kiosk", "Online check-in", "Phone triage"];

let counter = 0;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeCustomer(queueId: QueueId, position: number, waitMins: number): Customer {
  counter += 1;
  const first = pick(FIRST_NAMES);
  const last = pick(LAST_NAMES);
  const checkedIn = new Date(Date.now() - waitMins * 60_000);
  const createdYear = 2026 - Math.floor(Math.random() * 60);
  return {
    id: `c-${counter.toString().padStart(4, "0")}`,
    name: `${first} ${last}`,
    position,
    status: "waiting",
    waitMins,
    checkedInAt: checkedIn.toISOString(),
    phone: `(+1) 555-${(1000 + counter).toString().slice(-4)}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${counter}@example.com`,
    visitReason: pick(VISIT_REASONS),
    notes:
      Math.random() < 0.45
        ? pick([
            "Prefers text reminders.",
            "Uses wheelchair - room 2 preferred.",
            "Requested female provider if available.",
            "Bring insurance card to desk.",
            "Follow-up booked for next month.",
          ])
        : "",
    createdBy: pick(CREATORS),
    ticketNumber: `${queueId.slice(0, 1).toUpperCase()}${100 + counter}`,
    dateOfBirth: `${createdYear}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, "0")}-${String(
      Math.floor(Math.random() * 28) + 1
    ).padStart(2, "0")}`,
    language: pick(LANGUAGES),
  };
}

/**
 * Build a fresh, random snapshot for one queue. Wait times decrease with
 * position (the head of a FIFO queue has waited longest), so positions,
 * render order, and checked-in times all agree.
 */
export function makeSnapshot(queueId: QueueId, size?: number): QueueSnapshot {
  const n = size ?? Math.floor(Math.random() * 7) + 3; // 3–9 waiting
  const customers = Array.from({ length: n }, (_, i) => {
    // Head waits ~40-50 min, tail just checked in.
    const waitMins = Math.max(0, Math.round((n - i) * 6 + Math.random() * 5));
    return makeCustomer(queueId, i + 1, waitMins);
  });
  return { queueId, customers, updatedAt: new Date().toISOString() };
}

/** Seed all queues once at worker start so the demo is coherent. */
export function seedAllQueues(): Record<QueueId, QueueSnapshot> {
  return Object.fromEntries(QUEUES.map((q) => [q.id, makeSnapshot(q.id)])) as Record<
    QueueId,
    QueueSnapshot
  >;
}
