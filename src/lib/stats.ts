import type { Customer, QueueSnapshot } from "@/types";
import { waitInfo } from "./wait";

export interface QueueStats {
  waiting: number;
  avgWaitMins: number;
  longestWaitMins: number;
  longestWaitName: string | null;
}

/** Compute waiting count, average and longest wait from waiting customers only. */
export function computeStats(snapshot: QueueSnapshot | undefined, now: number): QueueStats {
  const waiting = (snapshot?.customers ?? []).filter((c) => c.status === "waiting");

  if (waiting.length === 0) {
    return { waiting: 0, avgWaitMins: 0, longestWaitMins: 0, longestWaitName: null };
  }

  const waits = waiting.map((c) => waitInfo(c.checkedInAt, now).mins);
  const avgWaitMins = Math.round(waits.reduce((a, b) => a + b, 0) / waits.length);
  const maxIndex = waits.indexOf(Math.max(...waits));

  return {
    waiting: waiting.length,
    avgWaitMins,
    longestWaitMins: waits[maxIndex],
    longestWaitName: waiting[maxIndex]?.name ?? null,
  };
}

export function findCustomer(customers: Customer[], id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}
