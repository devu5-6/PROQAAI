import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Customer, QueueId, QueueSnapshot } from "@/types";
import { api } from "@/lib/api";
import { QUEUES } from "@/lib/constants";
import { useToast } from "./toast-context";

export const queueKeys = {
  all: ["queues"] as const,
  one: (id: QueueId) => ["queues", id] as const,
};

function nameOf(customerId: string, snapshots: (QueueSnapshot | undefined)[]): string {
  for (const snap of snapshots) {
    const found = snap?.customers.find((c) => c.id === customerId);
    if (found) return found.name;
  }
  return "Customer";
}

function removeFromSnapshot(
  snap: QueueSnapshot,
  customerId: string
): QueueSnapshot {
  return {
    ...snap,
    customers: snap.customers
      .filter((c) => c.id !== customerId)
      .map((c, i) => ({ ...c, position: i + 1 })),
  };
}

const QUEUE_LABELS: Record<QueueId, string> = Object.fromEntries(
  QUEUES.map((q) => [q.id, q.name])
) as Record<QueueId, string>;

const ROLLBACK_SUFFIX = " Change was rolled back, please retry.";

/**
 * All four queue actions are optimistic: the cache is patched immediately,
 * and any server rejection rolls the affected queues back with a clear
 * error toast. Rejections are never silent.
 */
export function useQueueActions(queueId: QueueId) {
  const qc = useQueryClient();
  const { push } = useToast();

  const patch = (snap: QueueSnapshot) =>
    qc.setQueryData<QueueSnapshot>(queueKeys.one(snap.queueId), snap);

  const callNext = useMutation({
    mutationFn: () => api.callNext(queueId),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: queueKeys.one(queueId) });
      const previous = qc.getQueryData<QueueSnapshot>(queueKeys.one(queueId));
      if (!previous) return { previous: undefined };
      const customers = [...previous.customers];
      const headIndex = customers.findIndex((c) => c.status === "waiting");
      if (headIndex >= 0) {
        customers[headIndex] = { ...customers[headIndex], status: "called" };
        qc.setQueryData<QueueSnapshot>(queueKeys.one(queueId), { ...previous, customers });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) patch(ctx.previous);
      push("error", `Could not call next.${ROLLBACK_SUFFIX}`);
    },
    onSuccess: (data) => {
      patch(data);
      push("success", "Next customer called.");
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queueKeys.one(queueId) });
    },
  });

  /** Serve / no-show share one shape: the customer leaves the board. */
  const useLeaveMutation = (
    kind: "serve" | "no_show",
    messages: { success: string; error: string }
  ) =>
    useMutation({
      mutationFn: (customerId: string) =>
        kind === "serve"
          ? api.serve(queueId, customerId)
          : api.markNoShow(queueId, customerId),
      onMutate: async (customerId: string) => {
        await qc.cancelQueries({ queryKey: queueKeys.one(queueId) });
        const previous = qc.getQueryData<QueueSnapshot>(queueKeys.one(queueId));
        if (!previous) return { previous: undefined, name: "Customer" };
        qc.setQueryData<QueueSnapshot>(
          queueKeys.one(queueId),
          removeFromSnapshot(previous, customerId)
        );
        return { previous, name: nameOf(customerId, [previous]) };
      },
      onError: (_err, _customerId, ctx) => {
        if (ctx?.previous) patch(ctx.previous);
        push("error", `${ctx?.name ?? "Customer"}: ${messages.error}${ROLLBACK_SUFFIX}`);
      },
      onSuccess: (data, _customerId, ctx) => {
        patch(data);
        push("success", `${ctx?.name ?? "Customer"}: ${messages.success}`);
      },
      onSettled: () => {
        void qc.invalidateQueries({ queryKey: queueKeys.one(queueId) });
      },
    });

  const serve = useLeaveMutation("serve", {
    success: "marked as served.",
    error: "could not mark served.",
  });

  const noShow = useLeaveMutation("no_show", {
    success: "marked as no-show.",
    error: "could not mark no-show.",
  });

  const move = useMutation({
    mutationFn: ({ customerId, to }: { customerId: string; to: QueueId }) =>
      api.moveCustomer(queueId, customerId, to),
    onMutate: async ({ customerId, to }) => {
      await qc.cancelQueries({ queryKey: queueKeys.all });
      const fromPrev = qc.getQueryData<QueueSnapshot>(queueKeys.one(queueId));
      const toPrev = qc.getQueryData<QueueSnapshot>(queueKeys.one(to));
      const name = nameOf(customerId, [fromPrev, toPrev]);
      const moving = fromPrev?.customers.find((c) => c.id === customerId);

      if (fromPrev && moving) {
        qc.setQueryData<QueueSnapshot>(queueKeys.one(queueId), removeFromSnapshot(fromPrev, customerId));
      }
      if (toPrev && moving) {
        qc.setQueryData<QueueSnapshot>(queueKeys.one(to), {
          ...toPrev,
          customers: [...toPrev.customers, { ...moving, position: toPrev.customers.length + 1 }],
        });
      }
      return { fromPrev, toPrev, name };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.fromPrev) patch(ctx.fromPrev);
      if (ctx?.toPrev) patch(ctx.toPrev);
      push("error", `${ctx?.name ?? "Customer"}: could not move.${ROLLBACK_SUFFIX}`);
    },
    onSuccess: (data, vars, ctx) => {
      patch(data.from);
      patch(data.to);
      push("success", `${ctx?.name ?? "Customer"} moved to ${QUEUE_LABELS[vars.to]}.`);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: queueKeys.all });
    },
  });

  return { callNext, serve, noShow, move };
}

export type QueueActions = ReturnType<typeof useQueueActions>;

export type { Customer };
