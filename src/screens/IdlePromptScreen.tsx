import { Card } from "../components/ui/Card";
import { IconCircle } from "../components/ui/IconCircle";
import { Button } from "../components/ui/Button";
import { AlertIcon } from "../components/icons";
import { formatClock } from "../lib/mock";

interface IdlePromptScreenProps {
  idleMinutes: number;
  idleStartedAt: Date;
  idleEndedAt: Date;
  onKeep: () => void;
  onDiscard: () => void;
}

export function IdlePromptScreen({ idleMinutes, idleStartedAt, idleEndedAt, onKeep, onDiscard }: IdlePromptScreenProps) {
  return (
    <Card>
      <div className="px-5 py-7 text-center">
        <IconCircle tone="orange">
          <AlertIcon className="h-[26px] w-[26px]" />
        </IconCircle>
        <div className="mb-1.5 text-[15px] font-semibold">You've been idle</div>
        <div className="mb-1 font-mono text-[28px] text-orange">{idleMinutes} min</div>
        <div className="mb-4 text-[11px] text-muted">
          {formatClock(idleStartedAt)} – {formatClock(idleEndedAt)} · no keyboard or mouse activity
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
