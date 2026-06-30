import { Card } from "../components/ui/Card";
import { Avatar } from "../components/ui/Avatar";
import { StatusBadge } from "../components/ui/StatusBadge";
import { StatsGrid } from "../components/ui/StatsGrid";
import { ScreenshotStrip } from "../components/ui/ScreenshotStrip";
import { Button } from "../components/ui/Button";
import { PauseIcon, PipIcon, PlayIcon, SignOutIcon, StopIcon } from "../components/icons";
import { formatHM, formatHMS } from "../lib/mock";
import type { AppUsageEntry, AuthUser, ScreenshotEntry, TimeStats, TimerStatus, UrlUsageEntry } from "../types";

interface TimerScreenProps {
  user: AuthUser;
  status: TimerStatus;
  elapsedSeconds: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onSignOut: () => void;
  widgetVisible: boolean;
  onToggleWidget: () => void;
  stats: TimeStats;
  apps: AppUsageEntry[];
  urls: UrlUsageEntry[];
  screenshots: ScreenshotEntry[];
}

function ActivityList<T extends { id: string; seconds: number }>({
  title,
  items,
  render,
}: {
  title: string;
  items: T[];
  render: (item: T) => { primary: string; secondary: string };
}) {
  return (
    <div className="px-3.5 py-2.5">
      <div className="mb-1.5 text-[10px] uppercase tracking-wide text-muted">{title}</div>
      {items.length === 0 ? (
        <div className="text-[11px] text-muted">No activity tracked yet.</div>
      ) : (
        <div className="space-y-1">
          {items.map((item) => {
            const { primary, secondary } = render(item);
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 text-[11px]">
                <div className="min-w-0 flex-1 truncate text-text2">
                  <span className="text-text">{primary}</span>{" "}
                  <span className="text-muted">— {secondary}</span>
                </div>
                <div className="shrink-0 font-mono text-muted">{formatHM(item.seconds)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TimerScreen({
  user,
  status,
  elapsedSeconds,
  onPause,
  onResume,
  onStop,
  onSignOut,
  widgetVisible,
  onToggleWidget,
  stats,
  apps,
  urls,
  screenshots,
}: TimerScreenProps) {
  const isRunning = status === "running";
  const isPaused = status === "paused";
  const isStopped = status === "stopped";

  return (
    <Card>
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3">
        <Avatar initials={user.initials} />
        <div className="flex-1 text-[13px] font-medium">{user.name}</div>
        <StatusBadge status={status} />
        <button
          onClick={onToggleWidget}
          title={widgetVisible ? "Hide floating widget" : "Show floating widget"}
          className={`cursor-pointer appearance-none rounded p-1 transition-colors ${
            widgetVisible ? "text-accent" : "text-muted hover:text-text2"
          }`}
        >
          <PipIcon className="h-4 w-4" />
        </button>
        <button
          onClick={onSignOut}
          title="Sign out"
          className="cursor-pointer appearance-none rounded p-1 text-muted transition-colors hover:text-danger"
        >
          <SignOutIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="px-4 pb-4 pt-5 text-center">
        <div className={`font-mono text-[42px] font-medium leading-none tracking-tight ${isPaused ? "text-orange" : "text-text"}`}>
          {formatHMS(elapsedSeconds)}
        </div>
        <div className={`mb-[18px] text-[11px] uppercase tracking-wide ${isPaused ? "text-orange" : "text-muted"}`}>
          {isRunning ? "Today · Running" : isPaused ? "Paused · not tracking" : "Stopped · not tracking"}
        </div>
        <div className="mb-4 flex justify-center gap-2">
          {isRunning ? (
            <Button variant="pause" onClick={onPause}>
              <PauseIcon className="h-3.5 w-3.5" /> Pause
            </Button>
          ) : (
            <Button variant="start" onClick={onResume}>
              <PlayIcon className="h-3.5 w-3.5" /> {isStopped ? "Start" : "Resume"}
            </Button>
          )}
          <Button variant="stop" onClick={onStop}>
            <StopIcon className="h-3.5 w-3.5" /> Stop
          </Button>
        </div>
      </div>

      <StatsGrid
        stats={[
          { label: "Today tracked", value: formatHM(stats.todaySeconds + elapsedSeconds) },
          { label: "Idle today", value: formatHM(stats.idleSeconds), color: "orange" },
          { label: "This week", value: formatHM(stats.weekSeconds + elapsedSeconds), color: "blue" },
          { label: "This month", value: formatHM(stats.monthSeconds + elapsedSeconds), color: "blue" },
        ]}
      />

      <ScreenshotStrip screenshots={screenshots} />

      <div className="divide-y divide-border border-t border-border">
        <ActivityList
          title="Apps opened · time spent"
          items={apps}
          render={(a) => ({ primary: a.appName, secondary: a.windowTitle })}
        />
        <ActivityList
          title="URLs opened · time spent"
          items={urls}
          render={(u) => ({ primary: u.url, secondary: u.title })}
        />
      </div>
    </Card>
  );
}
