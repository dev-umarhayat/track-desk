import type { ScreenshotEntry } from "../../types";
import { formatClock, timeAgo } from "../../lib/mock";
import { CameraIcon } from "../icons";

interface ScreenshotStripProps {
  screenshots: ScreenshotEntry[];
}

export function ScreenshotStrip({ screenshots }: ScreenshotStripProps) {
  const latest = screenshots[0];

  return (
    <div className="border-t border-border bg-bg px-3.5 py-2.5">
      <div className="mb-[7px] text-[10px] uppercase tracking-wide text-muted">
        Last screenshot · {latest ? timeAgo(latest.capturedAt) : "none yet"}
      </div>
      <div className="flex gap-1.5">
        {screenshots.map((s) => (
          <div
            key={s.id}
            className="relative h-[34px] w-[52px] cursor-pointer overflow-hidden rounded border border-border bg-surface3"
            title={formatClock(s.capturedAt)}
          >
            <img src={s.dataUrl} alt="Screenshot" className="h-full w-full object-cover" />
            <div className="absolute bottom-0.5 right-0.5 rounded bg-black/60 px-0.5 font-mono text-[7px] text-white">
              {formatClock(s.capturedAt)}
            </div>
          </div>
        ))}
        <div className="flex h-[34px] w-[52px] items-center justify-center rounded border border-dashed border-border text-muted">
          <CameraIcon className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}
