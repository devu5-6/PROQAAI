import { memo } from "react";
import type { Customer, QueueId } from "@/types";
import { QUEUES } from "@/lib/constants";
import { formatWait, waitInfo } from "@/lib/wait";
import { Badge } from "@/components";
import { Button } from "@/components/Button";
import { Warning, Alarm } from "@phosphor-icons/react";
import type { QueueActions } from "./use-queue-actions";

export type ColumnId =
  | "position"
  | "name"
  | "status"
  | "wait"
  | "phone"
  | "email"
  | "visitReason"
  | "notes"
  | "createdBy"
  | "ticketNumber"
  | "dateOfBirth"
  | "language"
  | "checkedInAt"
  | "actions";

export const ALL_COLUMNS: { id: ColumnId; label: string; hideOnTablet?: boolean }[] = [
  { id: "position", label: "#" },
  { id: "name", label: "Name" },
  { id: "status", label: "Status" },
  { id: "wait", label: "Wait" },
  { id: "phone", label: "Phone", hideOnTablet: true },
  { id: "email", label: "Email", hideOnTablet: true },
  { id: "visitReason", label: "Visit reason", hideOnTablet: true },
  { id: "notes", label: "Notes", hideOnTablet: true },
  { id: "createdBy", label: "Created by", hideOnTablet: true },
  { id: "ticketNumber", label: "Ticket", hideOnTablet: true },
  { id: "dateOfBirth", label: "Date of birth", hideOnTablet: true },
  { id: "language", label: "Language", hideOnTablet: true },
  { id: "checkedInAt", label: "Checked in", hideOnTablet: true },
  { id: "actions", label: "Actions" },
];

const PROTECTED: ColumnId[] = ["position", "name", "actions"];

export function isProtectedColumn(id: ColumnId): boolean {
  return PROTECTED.includes(id);
}

interface CellProps {
  col: ColumnId;
  c: Customer;
  queueId: QueueId;
  onSelect: () => void;
  actions: QueueActions;
  now: number;
}

function Cell({ col, c, queueId, onSelect, actions, now }: CellProps) {
  switch (col) {
    case "position":
      return <span className="num">{c.position}</span>;
    case "name":
      return (
        <button
          type="button"
          className="link-like"
          onClick={onSelect}
          aria-haspopup="dialog"
          title={`Open details for ${c.name}`}
        >
          {c.name}
        </button>
      );
    case "status":
      return <Badge status={c.status} />;
    case "wait": {
      const info = waitInfo(c.checkedInAt, now);
      const cls = info.level === "stale" ? "stale" : info.level === "long" ? "long" : "";
      const WarnIcon = info.level === "stale" ? Alarm : Warning;
      return (
        <span className={`wait-pill ${cls}`}>
          {info.level !== "ok" && <WarnIcon size={12} weight="fill" aria-hidden />}
          {formatWait(info.mins)}
          <span className="sr-only">
            {info.level === "stale"
              ? ", stale: over 40 minutes"
              : info.level === "long"
                ? ", long: over 20 minutes"
                : ""}
          </span>
        </span>
      );
    }
    case "phone":
      return c.phone;
    case "email":
      return c.email;
    case "visitReason":
      return c.visitReason;
    case "notes":
      return c.notes ? c.notes : "None";
    case "createdBy":
      return c.createdBy;
    case "ticketNumber":
      return <span className="num">{c.ticketNumber}</span>;
    case "dateOfBirth":
      return <span className="num">{c.dateOfBirth}</span>;
    case "language":
      return c.language;
    case "checkedInAt":
      return (
        <span className="num">
          {new Date(c.checkedInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      );
    case "actions":
      return (
        <div className="actions-cell">
          <Button
            variant="primary"
            aria-label={`Serve ${c.name}`}
            onClick={() => void actions.serve.mutateAsync(c.id).catch(() => undefined)}
            loading={actions.serve.isPending && actions.serve.variables === c.id}
          >
            Serve
          </Button>
          <Button
            variant="danger"
            aria-label={`Mark ${c.name} as no-show`}
            onClick={() => void actions.noShow.mutateAsync(c.id).catch(() => undefined)}
            loading={actions.noShow.isPending && actions.noShow.variables === c.id}
          >
            No-show
          </Button>
          <select
            className="select"
            defaultValue=""
            aria-label={`Move ${c.name} to another queue`}
            onChange={(e) => {
              const to = e.target.value as QueueId;
              e.target.value = "";
              if (!to) return;
              void actions.move.mutateAsync({ customerId: c.id, to }).catch(() => undefined);
            }}
          >
            <option value="">Move to...</option>
            {QUEUES.filter((q) => q.id !== queueId).map((q) => (
              <option key={q.id} value={q.id}>
                {q.name}
              </option>
            ))}
          </select>
        </div>
      );
    default:
      return null;
  }
}

interface RowProps {
  customer: Customer;
  queueId: QueueId;
  selectedId: string | null;
  onSelect: (c: Customer) => void;
  actions: QueueActions;
  recentArrivals: Set<string>;
  now: number;
  visibleColumns: ColumnId[];
}

const Row = memo(function Row({
  customer: c,
  queueId,
  selectedId,
  onSelect,
  actions,
  recentArrivals,
  now,
  visibleColumns,
}: RowProps) {
  return (
    <tr
      className={`${selectedId === c.id ? "selected" : ""} ${recentArrivals.has(c.id) ? "arriving" : ""}`}
      aria-selected={selectedId === c.id}
    >
      {visibleColumns.map((col) => (
        <td
          key={col}
          className={
            ALL_COLUMNS.find((x) => x.id === col)?.hideOnTablet ? "hide-tablet" : undefined
          }
        >
          <Cell
            col={col}
            c={c}
            queueId={queueId}
            onSelect={() => onSelect(c)}
            actions={actions}
            now={now}
          />
        </td>
      ))}
    </tr>
  );
});

interface QueueTableProps {
  customers: Customer[];
  queueId: QueueId;
  selectedId: string | null;
  onSelect: (c: Customer) => void;
  actions: QueueActions;
  recentArrivals: Set<string>;
  now: number;
  visibleColumns: ColumnId[];
}

export function QueueTable({
  customers,
  queueId,
  selectedId,
  onSelect,
  actions,
  recentArrivals,
  now,
  visibleColumns,
}: QueueTableProps) {
  return (
    <div className="table-scroll" tabIndex={0} aria-label="Queue table scroll area">
      <table className="queue-table">
        <caption className="sr-only">
          Waiting customers in order. Open a customer by clicking their name; use the action
          buttons to serve, mark no-show, or move them to another queue.
        </caption>
        <thead>
          <tr>
            {visibleColumns.map((col) => {
              const meta = ALL_COLUMNS.find((c) => c.id === col);
              return (
                <th
                  key={col}
                  scope="col"
                  className={meta?.hideOnTablet ? "hide-tablet" : undefined}
                >
                  {meta?.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <Row
              key={c.id}
              customer={c}
              queueId={queueId}
              selectedId={selectedId}
              onSelect={onSelect}
              actions={actions}
              recentArrivals={recentArrivals}
              now={now}
              visibleColumns={visibleColumns}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
