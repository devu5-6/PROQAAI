import { WAIT_LONG_MINS } from "@/lib/constants";
import type { QueueStats } from "@/lib/stats";
import { formatWait } from "@/lib/wait";

interface SummaryStripProps {
  stats: QueueStats;
  loading: boolean;
}

/**
 * Top strip: waiting count, average wait, longest wait. The longest-wait
 * card switches to an alert treatment (icon + text + color) once it passes
 * the long-wait threshold.
 */
export function SummaryStrip({ stats, loading }: SummaryStripProps) {
  const longWait = stats.longestWaitMins >= WAIT_LONG_MINS;

  return (
    <section aria-label="Queue summary" className="summary-strip">
      <div className="summary-card">
        <div className="label">Customers waiting</div>
        <div className="value">{loading ? "—" : stats.waiting}</div>
        <div className="sub">across this queue</div>
      </div>

      <div className="summary-card">
        <div className="label">Average wait</div>
        <div className="value">{loading ? "—" : formatWait(stats.avgWaitMins)}</div>
        <div className="sub">waiting customers only</div>
      </div>

      <div className={`summary-card ${longWait ? "alert" : ""}`} aria-live="polite">
        <div className="label">
          Longest wait{" "}
          {longWait && (
            <i className="icon" aria-hidden="true" style={{ fontStyle: "normal" }}>
              ⚠
            </i>
          )}
        </div>
        <div className="value">{loading ? "—" : formatWait(stats.longestWaitMins)}</div>
        <div className="sub">
          {stats.longestWaitName ? stats.longestWaitName : "no one waiting"}
          {longWait ? " — over 20 minutes, act now" : ""}
        </div>
      </div>

      <div className="summary-card wide">
        <div className="label">Queue health</div>
        <div className="value" style={{ fontSize: "var(--text-xl)" }}>
          {loading
            ? "—"
            : longWait
              ? "Needs attention"
              : stats.waiting === 0
                ? "Clear"
                : "Steady"}
        </div>
        <div className="sub">
          {longWait
            ? `Someone has been waiting ${formatWait(stats.longestWaitMins)} — call them next.`
            : "All waits under 20 minutes."}
        </div>
      </div>
    </section>
  );
}
