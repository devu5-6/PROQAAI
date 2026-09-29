import { useCountUp } from "@/lib/use-count-up";
import { WAIT_LONG_MINS } from "@/lib/constants";
import type { QueueStats } from "@/lib/stats";

interface QueueGaugesProps {
  stats: QueueStats;
  loading: boolean;
}

const TICKS = 24;
const CX = 70;
const CY = 70;
const R_INNER = 50;
const R_OUTER = 63;

/** One tick mark of the segmented arc, i in [0, TICKS). */
function tickPath(i: number): string {
  // 180° span: from left (180°) to right (0°).
  const frac = (i + 0.5) / TICKS;
  const angle = Math.PI * (1 - frac);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const x1 = CX + R_INNER * cos;
  const y1 = CY - R_INNER * sin;
  const x2 = CX + R_OUTER * cos;
  const y2 = CY - R_OUTER * sin;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} L ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

function Gauge({
  label,
  value,
  suffix,
  min,
  max,
  tone,
  minCaption,
  maxCaption,
  stagger,
}: {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  tone: "ok" | "info" | "warn" | "danger";
  minCaption: string;
  maxCaption: string;
  stagger: string;
}) {
  const { value: shown } = useCountUp(value);
  const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const active = Math.max(1, Math.round(frac * TICKS));
  const color =
    tone === "ok"
      ? "var(--ok)"
      : tone === "warn"
        ? "var(--warn)"
        : tone === "danger"
          ? "var(--danger)"
          : "var(--accent-400)";

  return (
    <div className={`gauge-card rise ${stagger}`}>
      <span className="gauge-label">{label}</span>
      <svg viewBox="0 0 140 84" width="140" height="84" aria-hidden="true">
        {Array.from({ length: TICKS }, (_, i) => (
          <path
            key={i}
            d={tickPath(i)}
            stroke={i < active ? color : "var(--gray-200)"}
            strokeWidth={i < active ? 4 : 3}
            strokeLinecap="round"
            style={{ transition: "stroke 400ms var(--ease-out)" }}
          />
        ))}
        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          className="gauge-value"
          fill="var(--text)"
        >
          {shown}
          {suffix && <tspan fontSize="11">{suffix}</tspan>}
        </text>
      </svg>
      <div className="gauge-captions">
        <span>{minCaption}</span>
        <span>{maxCaption}</span>
      </div>
    </div>
  );
}

/**
 * Three arc-gauge stat cards (in queue / average wait / longest wait),
 * mirroring the reference dashboard's segmented gauge row.
 */
export function QueueGauges({ stats, loading }: QueueGaugesProps) {
  const longest = stats.longestWaitMins;
  const tone: "ok" | "warn" | "danger" =
    longest >= WAIT_LONG_MINS * 2 ? "danger" : longest >= WAIT_LONG_MINS ? "warn" : "ok";

  return (
    <div className="gauges" aria-label="Queue statistics">
      <Gauge
        label="In queue"
        value={loading ? 0 : stats.waiting}
        min={0}
        max={12}
        tone="info"
        minCaption="clear"
        maxCaption="busy"
        stagger="stagger-2"
      />
      <Gauge
        label="Average wait"
        value={loading ? 0 : stats.avgWaitMins}
        suffix="m"
        min={0}
        max={40}
        tone={loading ? "info" : stats.avgWaitMins >= WAIT_LONG_MINS ? "warn" : "ok"}
        minCaption="< 20 min"
        maxCaption="40+"
        stagger="stagger-3"
      />
      <Gauge
        label="Longest wait"
        value={loading ? 0 : longest}
        suffix="m"
        min={0}
        max={60}
        tone={loading ? "info" : tone}
        minCaption="< 20 min"
        maxCaption="60+"
        stagger="stagger-4"
      />
    </div>
  );
}
