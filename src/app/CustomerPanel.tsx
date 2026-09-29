import type { Customer, QueueId } from "@/types";
import { QUEUES } from "@/lib/constants";
import { formatWait, waitInfo } from "@/lib/wait";
import { Badge, Button, Drawer } from "@/components";
import type { QueueActions } from "./use-queue-actions";

interface CustomerPanelProps {
  customer: Customer | null;
  queueId: QueueId;
  onClose: () => void;
  actions: QueueActions;
}

/**
 * Customer detail panel (drawer). Shows all 14 fields — the PM's "staff
 * never have to click" concern is answered here with a single click, not
 * fourteen columns of unreadable table.
 */
export function CustomerPanel({ customer, queueId, onClose, actions }: CustomerPanelProps) {
  const info = customer ? waitInfo(customer.checkedInAt) : null;

  return (
    <Drawer open={customer !== null} onClose={onClose} title="Customer details">
      {customer && (
        <>
          <div className="drawer-header">
            <h2 id="drawer-title">{customer.name}</h2>
            <Button variant="ghost" onClick={onClose} aria-label="Close customer details">
              ✕ Close
            </Button>
          </div>
          <div className="drawer-body">
            <p style={{ marginBottom: "var(--space-4)" }}>
              <Badge status={customer.status} />{" "}
              <span className="num">
                {info && (
                  <>
                    Waiting {formatWait(info.mins)}
                    {info.level !== "ok" ? " — long wait" : ""}
                  </>
                )}
              </span>
            </p>

            <dl className="detail-grid">
              <div className="detail-item">
                <dt className="label">Position</dt>
                <dd className="value num">{customer.position}</dd>
              </div>
              <div className="detail-item">
                <dt className="label">Ticket</dt>
                <dd className="value num">{customer.ticketNumber}</dd>
              </div>
              <div className="detail-item">
                <dt className="label">Phone</dt>
                <dd className="value">
                  <a href={`tel:${customer.phone.replace(/[^+\d]/g, "")}`}>{customer.phone}</a>
                </dd>
              </div>
              <div className="detail-item">
                <dt className="label">Email</dt>
                <dd className="value">
                  <a href={`mailto:${customer.email}`}>{customer.email}</a>
                </dd>
              </div>
              <div className="detail-item">
                <dt className="label">Visit reason</dt>
                <dd className="value">{customer.visitReason}</dd>
              </div>
              <div className="detail-item">
                <dt className="label">Language</dt>
                <dd className="value">{customer.language}</dd>
              </div>
              <div className="detail-item">
                <dt className="label">Checked in</dt>
                <dd className="value num">
                  {new Date(customer.checkedInAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
              <div className="detail-item">
                <dt className="label">Date of birth</dt>
                <dd className="value num">{customer.dateOfBirth}</dd>
              </div>
              <div className="detail-item full">
                <dt className="label">Notes</dt>
                <dd className="value">{customer.notes || "—"}</dd>
              </div>
              <div className="detail-item">
                <dt className="label">Created by</dt>
                <dd className="value">{customer.createdBy}</dd>
              </div>
            </dl>

            <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-5)", flexWrap: "wrap" }}>
              <Button
                variant="primary"
                onClick={() => actions.serve.mutateAsync(customer.id).catch(() => undefined)}
                loading={actions.serve.isPending && actions.serve.variables === customer.id}
              >
                Mark served
              </Button>
              <Button
                variant="danger"
                onClick={() => actions.noShow.mutateAsync(customer.id).catch(() => undefined)}
                loading={actions.noShow.isPending && actions.noShow.variables === customer.id}
              >
                Mark no-show
              </Button>
              <label className="sr-only" htmlFor="panel-move">
                Move {customer.name} to another queue
              </label>
              <select
                id="panel-move"
                className="select"
                defaultValue=""
                aria-label={`Move ${customer.name} to another queue`}
                onChange={(e) => {
                  const to = e.target.value as QueueId;
                  if (!to) return;
                  actions.move.mutateAsync({ customerId: customer.id, to }).catch(() => undefined);
                  onClose();
                }}
              >
                <option value="">Move to…</option>
                {QUEUES.filter((q) => q.id !== queueId).map((q) => (
                  <option key={q.id} value={q.id}>
                    Move to {q.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
