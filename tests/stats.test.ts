import { describe, expect, it } from "vitest";
import { computeStats } from "@/lib/stats";
import type { Customer, QueueSnapshot } from "@/types";

const NOW = new Date("2026-09-29T12:00:00Z").getTime();

function customer(partial: Partial<Customer>): Customer {
  return {
    id: "x",
    name: "Test User",
    position: 1,
    status: "waiting",
    waitMins: 0,
    checkedInAt: new Date(NOW - 10 * 60_000).toISOString(),
    phone: "",
    email: "",
    visitReason: "",
    notes: "",
    createdBy: "",
    ticketNumber: "",
    dateOfBirth: "",
    language: "",
    ...partial,
  };
}

function snapshot(customers: Customer[]): QueueSnapshot {
  return { queueId: "general", customers, updatedAt: new Date(NOW).toISOString() };
}

describe("computeStats", () => {
  it("returns zeros for an empty queue", () => {
    const stats = computeStats(snapshot([]), NOW);
    expect(stats).toEqual({ waiting: 0, avgWaitMins: 0, longestWaitMins: 0, longestWaitName: null });
  });

  it("counts only waiting customers", () => {
    const snap = snapshot([
      customer({ id: "1", checkedInAt: new Date(NOW - 10 * 60_000).toISOString() }),
      customer({ id: "2", status: "called", checkedInAt: new Date(NOW - 50 * 60_000).toISOString() }),
    ]);
    const stats = computeStats(snap, NOW);
    expect(stats.waiting).toBe(1);
    expect(stats.longestWaitMins).toBe(10);
  });

  it("computes average and longest wait across waiting customers", () => {
    const snap = snapshot([
      customer({ id: "1", checkedInAt: new Date(NOW - 10 * 60_000).toISOString() }),
      customer({ id: "2", checkedInAt: new Date(NOW - 30 * 60_000).toISOString() }),
      customer({ id: "3", checkedInAt: new Date(NOW - 20 * 60_000).toISOString() }),
    ]);
    const stats = computeStats(snap, NOW);
    expect(stats.avgWaitMins).toBe(20);
    expect(stats.longestWaitMins).toBe(30);
    expect(stats.longestWaitName).toBe("Test User");
  });
});
