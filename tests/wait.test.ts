import { describe, expect, it } from "vitest";
import { formatWait, waitInfo } from "@/lib/wait";

const NOW = new Date("2026-09-29T12:00:00Z").getTime();

describe("waitInfo", () => {
  it("returns 0 minutes for a customer who just checked in", () => {
    const { mins, level } = waitInfo(new Date(NOW).toISOString(), NOW);
    expect(mins).toBe(0);
    expect(level).toBe("ok");
  });

  it("classifies 20+ minutes as long", () => {
    const checkedIn = new Date(NOW - 20 * 60_000).toISOString();
    expect(waitInfo(checkedIn, NOW)).toMatchObject({ mins: 20, level: "long" });
  });

  it("classifies 40+ minutes as stale", () => {
    const checkedIn = new Date(NOW - 41 * 60_000).toISOString();
    expect(waitInfo(checkedIn, NOW)).toMatchObject({ mins: 41, level: "stale" });
  });

  it("never returns negative minutes for future timestamps", () => {
    const checkedIn = new Date(NOW + 5 * 60_000).toISOString();
    expect(waitInfo(checkedIn, NOW).mins).toBe(0);
  });
});

describe("formatWait", () => {
  it("formats minutes under an hour", () => {
    expect(formatWait(42)).toBe("42 min");
  });

  it("formats whole hours", () => {
    expect(formatWait(120)).toBe("2 h");
  });

  it("formats hours and minutes", () => {
    expect(formatWait(75)).toBe("1 h 15 min");
  });
});
