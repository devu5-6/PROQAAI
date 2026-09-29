import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { QueueId } from "@/types";
import { api } from "@/lib/api";
import { queueKeys } from "./use-queue-actions";

export const POLL_INTERVAL_MS = 5000;

/**
 * Polls one queue every 5s. Polling pauses while the tab is hidden
 * (refetchOnWindowFocus refetches on return) so background tabs do not
 * hammer the mock server.
 */
export function useQueueQuery(queueId: QueueId) {
  return useQuery({
    queryKey: queueKeys.one(queueId),
    queryFn: ({ signal }) => api.getQueue(queueId, signal),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 2000,
  });
}

/**
 * Tracks customer IDs that appeared recently so the board can highlight
 * new arrivals without reordering rows the user is looking at.
 */
export function useRecentArrivals(customers: { id: string }[] | undefined, now: number) {
  const [recent, setRecent] = useState<Set<string>>(() => new Set());
  const seen = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  useEffect(() => {
    if (!customers) return;
    if (firstLoad.current) {
      customers.forEach((c) => seen.current.add(c.id));
      firstLoad.current = false;
      return;
    }
    const fresh = customers.filter((c) => !seen.current.has(c.id));
    if (fresh.length > 0) {
      fresh.forEach((c) => seen.current.add(c.id));
      setRecent((prev) => {
        const next = new Set(prev);
        fresh.forEach((c) => next.add(c.id));
        return next;
      });
      window.setTimeout(() => {
        setRecent((prev) => {
          const next = new Set(prev);
          fresh.forEach((c) => next.delete(c.id));
          return next;
        });
      }, 4000);
    }
  }, [customers, now]);

  return recent;
}
