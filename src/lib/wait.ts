import { WAIT_LONG_MINS, WAIT_STALE_MINS } from "./constants";

export interface WaitInfo {
  mins: number;
  level: "ok" | "long" | "stale";
}

/** Whole minutes elapsed since check-in. Recomputed live, not a stored column. */
export function waitInfo(checkedInAt: string, now: number = Date.now()): WaitInfo {
  const mins = Math.max(0, Math.floor((now - new Date(checkedInAt).getTime()) / 60_000));
  const level = mins >= WAIT_STALE_MINS ? "stale" : mins >= WAIT_LONG_MINS ? "long" : "ok";
  return { mins, level };
}

export function formatWait(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
