import { useEffect, useState } from "react";
import { Card } from "../components/ui/Card";
import { IconCircle } from "../components/ui/IconCircle";
import { Button } from "../components/ui/Button";
import { AlertIcon } from "../components/icons";
import { formatClock } from "../lib/mock";

interface IdlePromptScreenProps {
  idleStartedAt: Date;
  onKeep: () => void;
  onDiscard: () => void;
}

function formatDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function IdlePromptScreen({ idleStartedAt, onKeep, onDiscard }: IdlePromptScreenProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(
    Math.round((Date.now() - idleStartedAt.getTime()) / 1000),
  );
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - idleStartedAt.getTime()) / 1000));
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, [idleStartedAt]);

  return (
    <Card>
      <div className="px-5 py-7 text-center">
        <IconCircle tone="orange">
          <AlertIcon className="h-[26px] w-[26px]" />
        </IconCircle>
        <div className="mb-1.5 text-[15px] font-semibold">You've been idle</div>
        <div className="mb-1 font-mono text-[28px] text-orange">{formatDuration(elapsedSeconds)}</div>
        <div className="mb-4 text-[11px] text-muted">
          {formatClock(idleStartedAt)} – {formatClock(now)} · no keyboard or mouse activity
        </div>
        <div className="mb-4 text-xs text-muted">What would you like to do with this time?</div>
        <div className="flex gap-2">
          <Button variant="keep" onClick={onKeep}>
            Keep time
          </Button>
          <Button variant="discard" onClick={onDiscard}>
            Discard idle
          </Button>
        </div>
      </div>
    </Card>
  );
}
