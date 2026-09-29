import type { QueueStatus } from "@/types";
import { STATUS_LABELS } from "@/lib/constants";
import "./button.css";

const STATUS_ICONS: Record<QueueStatus, string> = {
  waiting: "⏳",
  called: "🔔",
  served: "✓",
  no_show: "∅",
};

interface BadgeProps {
  status: QueueStatus;
}

/** Status conveyed by label + icon + color — never color alone (a11y req). */
export function Badge({ status }: BadgeProps) {
  return (
    <span className={`badge badge--${status}`}>
      <span className="dot" aria-hidden="true" />
      <span aria-hidden="true" className="icon">{STATUS_ICONS[status]}</span>
      {STATUS_LABELS[status]}
    </span>
  );
}
