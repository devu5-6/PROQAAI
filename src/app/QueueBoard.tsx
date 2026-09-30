import { useEffect, useMemo, useState } from "react";
import type { Customer, QueueId } from "@/types";
import { QUEUES, WAIT_LONG_MINS } from "@/lib/constants";
import { computeStats } from "@/lib/stats";
import { reorderForRender } from "@/lib/stability";
import { useQueueQuery, useRecentArrivals } from "./use-queue-query";
import { useQueueActions } from "./use-queue-actions";
import type { ColumnId } from "./QueueTable";
import { ALL_COLUMNS, QueueTable } from "./QueueTable";
import { QueueGauges } from "./QueueGauges";
import { CustomerPanel } from "./CustomerPanel";
import { Sidebar } from "./Sidebar";
import { HeartModel } from "./HeartModel";
import { Topbar } from "./Topbar";
import { formatWait } from "@/lib/wait";
import { Button, EmptyState, ErrorState, Select, SkeletonRows } from "@/components";
import { WarningCircle, Warning, Tray, CaretDownIcon } from "@phosphor-icons/react";

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

export default function QueueBoard({ initialQueue = "general" }: QueueBoardProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const stored = window.localStorage.getItem("biotrack-theme");
    return stored === "dark" ? "dark" : "light";
  });
  const [search, setSearch] = useState("");
  const [queueId, setQueueId] = useState<QueueId>(initialQueue);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<ColumnId[]>(DEFAULT_COLUMNS);
  // Columns the user switched on by hand. They must survive the tablet
  // auto-hide ("hide-tablet"), otherwise checking a box would appear to do
  // nothing on ≤900px screens and the picker would look broken.
  const [userColumns, setUserColumns] = useState<Set<ColumnId>>(() => new Set());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("biotrack-theme", theme);
  }, [theme]);

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
    () => (customers ? reorderForRender(customers) : []),
    [customers]
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.visitReason.toLowerCase().includes(q)
    );
  }, [ordered, search]);
  const stats = useMemo(
    () => computeStats(query.data, now),
    [query.data, now]
  );
  const recent = useRecentArrivals(customers, now);

  const waiting = stats.waiting;
  const avg = Math.round(stats.avgWaitMins);
  const longest = stats.longestWaitMins;
  const longWait = longest >= WAIT_LONG_MINS;

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
    // Track explicit user choices so they survive the tablet auto-hide:
    // a column the user added must stay visible even on ≤900px screens.
    setUserColumns((prev) => {
      const next = new Set(prev);
      if (visibleColumns.includes(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      <summary className="btn btn--secondary btn--sm">
        Filter <CaretDownIcon className="caret" size={15} />
      </summary>
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
    <div className="shell">
      <Sidebar theme={theme} onToggleTheme={() => setTheme(theme === "dark" ? "light" : "dark")} />
      <div className="main" id="queue-main">
        <div className="rise">
          <Topbar search={search} onSearch={setSearch} />
        </div>

        <section className="hero rise stagger-1" aria-label="Overview">
          <h2>
            Patient
            <br />
            Dashboard
          </h2>
          <div className="hero-stats">
            <div className="hero-stat">
              <div className="big num">{waiting}</div>
              <div className="cap">In queue</div>
            </div>
            <div className="hero-stat">
              <div className="big num">{formatWait(avg)}</div>
              <div className="cap">Average wait</div>
            </div>
            <div className="hero-stat">
              <div
                className="big num"
                style={longWait ? { color: "var(--warn-strong)" } : undefined}
              >
                {formatWait(longest)}
                {longWait && (
                  <Warning size={18} weight="fill" aria-hidden />
                )}
              </div>
              <div className="cap">
                {longWait
                  ? `${stats.longestWaitName ?? "Someone"} · over ${WAIT_LONG_MINS} min`
                  : "Longest wait"}
              </div>
            </div>
            <div className="hero-stat">
              <div className="big big--text">
                {longWait ? "Needs attention" : waiting === 0 ? "Clear" : "Steady"}
              </div>
              <div className="cap">Queue health</div>
            </div>
          </div>
        </section>

        <div className="heart-row rise stagger-2">
          <HeartModel />
          <div className="side-col">
            <QueueGauges stats={stats} loading={query.isPending} />
            <section className="board-card" aria-label="Live queue board">
          <div className="board-toolbar">
            <h3>Waiting list</h3>
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
                disabled={ordered.length === 0}
              >
                Call next
              </Button>
            </div>
          </div>

          {query.isPending ? (
            <SkeletonRows rows={6} />
          ) : !query.data && query.isError ? (
            <ErrorState
              message={query.error instanceof Error ? query.error.message : undefined}
              onRetry={() => void query.refetch()}
              retrying={query.isFetching}
            />
          ) : query.data && filtered.length === 0 ? (
            <EmptyState
              icon={<Tray size={22} weight="duotone" />}
              title={search ? "No matches" : "No one is waiting"}
              hint={
                search
                  ? `Nothing in this queue matches “${search}”.`
                  : "New check-ins appear here automatically as they come in."
              }
            />
          ) : (
            <>
              {query.isError && (
                <div
                  className="stale-banner"
                  role="status"
                  title={query.error instanceof Error ? query.error.message : String(query.error)}
                >
                  <WarningCircle size={14} weight="bold" aria-hidden="true" />
                  <span className="stale-banner__text">
                    Can&rsquo;t reach the queue right now. Showing the last saved update.
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="stale-banner__retry"
                    onClick={() => void query.refetch()}
                    loading={query.isFetching}
                  >
                    Retry now
                  </Button>
                </div>
              )}
              <QueueTable
                customers={filtered}
                queueId={queueId}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                actions={actions}
                recentArrivals={recent}
                now={now}
                visibleColumns={visibleColumns}
                userColumns={userColumns}
              />
            </>
          )}
            </section>
          </div>
        </div>
      </div>
      <CustomerPanel
        customer={selected}
        queueId={queueId}
        onClose={() => setSelected(null)}
        actions={actions}
      />
    </div>
  );
}
