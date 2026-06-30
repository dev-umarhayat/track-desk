import type { TimerStatus } from "../../types";

interface StatusBadgeProps {
  status: TimerStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const LABEL: Record<TimerStatus, string> = {
  running: "Tracking",
  paused: "Paused",
  stopped: "Stopped",
};

export function StatusBadge({ status, size = "md", showLabel = true }: StatusBadgeProps) {
  const isRunning = status === "running";
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-[7px] w-[7px]";
  const color = isRunning ? "bg-accent shadow-[0_0_6px_var(--color-accent)]" : "bg-orange shadow-[0_0_6px_var(--color-orange)]";
  const textColor = isRunning ? "text-accent" : "text-orange";

  return (
    <div className={`flex items-center gap-[5px] text-[11px] ${textColor}`}>
      <span className={`rounded-full ${dotSize} ${color}`} />
      {showLabel && LABEL[status]}
    </div>
  );
}
