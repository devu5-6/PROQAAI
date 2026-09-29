import { Warning } from "@phosphor-icons/react";
import { WAIT_LONG_MINS } from "@/lib/constants";
import type { QueueStats } from "@/lib/stats";
import { formatWait } from "@/lib/wait";

interface SummaryStripProps {
  stats: QueueStats;
  loading: boolean;
}

/**
 * One hairline band: waiting, average, longest wait. The longest-wait cell
 * escalates with tint + icon + text once it passes the threshold.
 */
export function SummaryStrip({ stats, loading }: SummaryStripProps) {
  const longWait = stats.longestWaitMins >= WAIT_LONG_MINS;

  return (
    <section aria-label="Queue summary" className="summary-strip">
      <div className="summary-card">
        <div className="label">Waiting</div>
        <div className="value num">{loading ? "-" : stats.waiting}</div>
        <div className="sub">customers in queue</div>
      </div>

      <div className="summary-card">
        <div className="label">Average wait</div>
        <div className="value">{loading ? "-" : formatWait(stats.avgWaitMins)}</div>
        <div className="sub">waiting customers only</div>
      </div>

      <div className={`summary-card ${longWait ? "alert" : ""}`} aria-live="polite">
        <div className="label">Longest wait</div>
        <div className="value">
          {loading ? "-" : formatWait(stats.longestWaitMins)}
          {longWait && <Warning size={18} weight="fill" aria-hidden />}
        </div>
        <div className="sub">
          {stats.longestWaitName ? (
            <>
              <strong>{stats.longestWaitName}</strong>
              {longWait ? `, over ${WAIT_LONG_MINS} min, call next` : ", next in line"}
            </>
          ) : (
            "no one waiting"
          )}
        </div>
      </div>

      <div className="summary-card health">
        <div className="label">Queue health</div>
        <div className="value" style={{ fontSize: "var(--text-2xl)" }}>
          {loading ? "-" : longWait ? "Needs attention" : stats.waiting === 0 ? "Clear" : "Steady"}
        </div>
        <div className="sub">
          {longWait
            ? `Someone has waited ${formatWait(stats.longestWaitMins)}`
            : `All waits under ${WAIT_LONG_MINS} min`}
        </div>
      </div>
    </section>
  );
}
