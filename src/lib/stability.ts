import type { Customer } from "@/types";

/**
 * Render order: called customers first (they are actively being seen),
 * then waiting customers in check-in order (FIFO). Ties keep their prior
 * relative order via the stable sort, so equal timestamps never reshuffle
 * rows that the user is looking at.
 */
export function reorderForRender(customers: Customer[]): Customer[] {
  const waiting: Customer[] = [];
  const called: Customer[] = [];

  for (const c of customers) {
    if (c.status === "called") called.push(c);
    else if (c.status === "waiting") waiting.push(c);
  }

  waiting.sort((a, b) => {
    const ta = new Date(a.checkedInAt).getTime();
    const tb = new Date(b.checkedInAt).getTime();
    return ta === tb ? 0 : ta < tb ? -1 : 1;
  });

  return [...called, ...waiting];
}
