import type { ScreenshotEntry, TimerStatus } from "../types";
import { formatHMS, timeAgo } from "../lib/mock";
import { Button } from "./ui/Button";
import { CameraIcon, CloseIcon, PauseIcon, PlayIcon, StopIcon } from "./icons";

interface FloatingWidgetProps {
  status: TimerStatus;
  elapsedSeconds: number;
  lastScreenshot?: ScreenshotEntry;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onClose?: () => void;
}

export function FloatingWidget({
  status,
  elapsedSeconds,
  lastScreenshot,
  onPause,
  onResume,
  onStop,
  onClose,
}: FloatingWidgetProps) {
  const isRunning = status === "running";

  return (
    <div className="w-[220px] rounded-2xl border border-border bg-surface p-3.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            isRunning ? "bg-accent shadow-[0_0_8px_var(--color-accent)]" : "bg-orange shadow-[0_0_8px_var(--color-orange)]"
          }`}
        />
        <div className="flex-1 font-mono text-lg font-medium">{formatHMS(elapsedSeconds)}</div>
        {onClose && (
          <button onClick={onClose} className="cursor-pointer text-muted hover:text-text">
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="mt-2.5 flex gap-1.5">
        {isRunning ? (
          <Button variant="fw" onClick={onPause}>
            <span className="inline-flex items-center gap-1">
              <PauseIcon className="h-3 w-3" /> Pause
            </span>
          </Button>
        ) : (
          <Button variant="fw" onClick={onResume}>
            <span className="inline-flex items-center gap-1">
              <PlayIcon className="h-3 w-3" /> Resume
            </span>
          </Button>
        )}
        <Button variant="fw" onClick={onStop}>
          <span className="inline-flex items-center gap-1">
            <StopIcon className="h-3 w-3" /> Stop
          </span>
        </Button>        
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="text-[9px] text-muted">
          Last capture {lastScreenshot ? timeAgo(lastScreenshot.capturedAt) : "none yet"}
        </div>
        <div
          className="mt-0 flex h-[26px] w-[38px] cursor-pointer items-center justify-center overflow-hidden rounded border border-border bg-surface3 text-muted"
          title="Last screenshot preview"
        >
          {lastScreenshot ? (
            <img src={lastScreenshot.dataUrl} alt="Last screenshot" className="h-full w-full object-cover" />
          ) : (
            <CameraIcon className="h-3 w-3" />
          )}
        </div>
      </div>
    </div>
  );
}
