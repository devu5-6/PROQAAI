import type { QueueStatus } from "@/types";
import { STATUS_LABELS } from "@/lib/constants";
import { Clock, BellRinging, CheckCircle, UserMinus } from "@phosphor-icons/react";
import "./button.css";

const STATUS_ICONS = {
  waiting: Clock,
  called: BellRinging,
  served: CheckCircle,
  no_show: UserMinus,
} as const;

interface BadgeProps {
  status: QueueStatus;
}

/* Status = icon + label + tint. Never color alone (a11y requirement). */
export function Badge({ status }: BadgeProps) {
  const Icon = STATUS_ICONS[status];
  return (
    <span className={`status-pill status-pill--${status}`}>
      <Icon size={12} weight="bold" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
