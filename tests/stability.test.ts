import { describe, expect, it } from "vitest";
import { reorderForRender } from "@/lib/stability";

const NOW = new Date("2026-09-29T12:00:00Z").getTime();

function make(id: string, minsAgo: number, status: "waiting" | "called" = "waiting") {
  return {
    id,
    status,
    checkedInAt: new Date(NOW - minsAgo * 60_000).toISOString(),
  };
}

describe("reorderForRender", () => {
  it("sorts waiting customers by check-in time (FIFO)", () => {
    const list = [make("c2", 5), make("c1", 10), make("c3", 1)];
    const [first, , third] = reorderForRender(list as never, NOW);
    expect(first.id).toBe("c1");
    expect(third.id).toBe("c3");
  });

  it("keeps called customers pinned at the top", () => {
    const list = [make("waiting1", 20), make("called1", 2, "called")];
    const [first] = reorderForRender(list as never, NOW);
    expect(first.id).toBe("called1");
  });

  it("is stable for ties (equal timestamps keep previous order)", () => {
    const list = [make("a", 5), make("b", 5), make("c", 5)];
    const [first, second, third] = reorderForRender(list as never, NOW);
    expect([first.id, second.id, third.id]).toEqual(["a", "b", "c"]);
  });
});
