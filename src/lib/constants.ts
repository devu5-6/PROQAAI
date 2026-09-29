import type { Queue, QueueId, QueueStatus } from "@/types";

export const QUEUES: Queue[] = [
  { id: "general", name: "General" },
  { id: "vaccination", name: "Vaccination" },
  { id: "billing", name: "Billing" },
];

export const QUEUE_IDS: QueueId[] = QUEUES.map((q) => q.id);

export const STATUS_LABELS: Record<QueueStatus, string> = {
  waiting: "Waiting",
  called: "Called",
  served: "Served",
  no_show: "No-show",
};

/**
 * Row-level wait thresholds. Kept in one place so the summary strip,
 * wait pills, and UX docs agree on what "long" means.
 */
export const WAIT_LONG_MINS = 20;
export const WAIT_STALE_MINS = 40;
