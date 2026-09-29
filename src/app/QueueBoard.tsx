import { useEffect, useMemo, useState } from "react";
import type { Customer, QueueId } from "@/types";
import { QUEUES } from "@/lib/constants";
import { computeStats } from "@/lib/stats";
import { reorderForRender } from "@/lib/stability";
import { useQueueQuery, useRecentArrivals } from "./use-queue-query";
import { useQueueActions } from "./use-queue-actions";
import type { ColumnId } from "./QueueTable";
import { ALL_COLUMNS, QueueTable } from "./QueueTable";
import { SummaryStrip } from "./SummaryStrip";
import { CustomerPanel } from "./CustomerPanel";
import { Button, EmptyState, ErrorState, Select, SkeletonRows } from "@/components";

const DEFAULT_COLUMNS: ColumnId[] = [
  "position",
  "name",
  "status",
  "wait",
  "visitReason",
  "actions",
];

const PROTECTED_COLUMNS: ColumnId[] = ["position", "name", "actions"];

interface QueueBoardProps {
  initialQueue?: QueueId;
}

export function QueueBoard({ initialQueue = "general" }: QueueBoardProps) {
  const [queueId, setQueueId] = useState<QueueId>(initialQueue);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);

  const query = useQueueQuery(queueId);
  const actions = useQueueActions(queueId);

  // One shared clock so wait pills and summary stats agree; ticks every 30s.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const customers = query.data?.customers;
  const ordered = useMemo(
    () => (customers ? reorderForRender(customers, now) : []),
    [customers, now]
  );
  const stats = useMemo(() => computeStats(query.data, now), [query.data, now]);
  const recent = useRecentArrivals(customers, now);

  // Close the detail panel if its customer left the board (served, no-show, moved).
  useEffect(() => {
    if (selected && customers && !customers.some((c) => c.id === selected.id)) {
      setSelected(null);
    }
  }, [customers, selected]);

  async function handleCallNext() {
    await actions.callNext.mutateAsync().catch(() => undefined);
  }

  function toggleColumn(id: ColumnId) {
    setVisibleColumns((prev) => {
      if (prev.includes(id)) {
        if (PROTECTED_COLUMNS.includes(id)) return prev;
        return prev.filter((c) => c !== id);
      }
      // Re-insert in canonical order so columns never shuffle.
      return ALL_COLUMNS.filter((c) => prev.includes(c.id) || c.id === id).map((c) => c.id);
    });
  }

  const columnPicker = (
    <details className="column-picker">
      <summary className="btn btn--secondary btn--sm">Columns ▾</summary>
      <div className="column-picker-menu" role="group" aria-label="Visible columns">
        {ALL_COLUMNS.filter((c) => c.id !== "actions").map((col) => (
          <label key={col.id} className="column-picker-item">
            <input
              type="checkbox"
              checked={visibleColumns.includes(col.id)}
              onChange={() => toggleColumn(col.id)}
            />{" "}
            {col.label}
          </label>
        ))}
      </div>
    </details>
  );

  return (
    <>
      <SummaryStrip stats={stats} loading={query.isPending} />

      <div className={`board-layout ${selected ? "with-panel" : ""}`}>
        <section className="board-card" aria-label="Live queue board">
          <div className="board-toolbar">
            <h2>Waiting list</h2>
            <div className="toolbar-group">
              <Select
                label="Queue"
                hideLabel
                value={queueId}
                onChange={(e) => {
                  setQueueId(e.target.value as QueueId);
                  setSelected(null);
                }}
                options={QUEUES.map((q) => ({ value: q.id, label: `${q.name} queue` }))}
              />
              {columnPicker}
              <Button
                variant="primary"
                size="md"
                onClick={handleCallNext}
                loading={actions.callNext.isPending}
              >
                Call next
              </Button>
            </div>
          </div>

          {query.isPending ? (
            <SkeletonRows rows={6} />
          ) : query.isError ? (
            <ErrorState
              message={query.error instanceof Error ? query.error.message : undefined}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : ordered.length === 0 ? (
            <EmptyState
              title="No one is waiting"
              hint="New check-ins will appear here automatically. Enjoy the quiet moment."
            />
          ) : (
            <QueueTable
              customers={ordered}
              queueId={queueId}
              selectedId={selected?.id ?? null}
              onSelect={setSelected}
              actions={actions}
              recentArrivals={recent}
              now={now}
              visibleColumns={visibleColumns}
            />
          )}
        </section>

        <CustomerPanel
          customer={selected}
          queueId={queueId}
          onClose={() => setSelected(null)}
          actions={actions}
        />
      </div>
    </>
  );
}
