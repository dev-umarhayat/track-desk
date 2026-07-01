import { useEffect, useState } from "react";
import { onDevData, requestDevData, type DevSyncPayload } from "../lib/tauriBridge";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import "../App.css";

type SyncStatus = "synced" | "pending";

function SyncBadge({ status }: { status: SyncStatus }) {
  return status === "synced" ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-medium text-green-400">
      ● synced
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/40 px-2 py-0.5 text-[10px] font-medium text-yellow-400">
      ○ pending
    </span>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">{title}</span>
      <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/30">{count}</span>
    </div>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="text-[11px] text-white/20">{label}</div>;
}

function formatSeconds(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function truncateUrl(url: string, max = 42) {
  try {
    const { hostname, pathname } = new URL(url);
    const short = hostname + pathname;
    return short.length > max ? short.slice(0, max) + "…" : short;
  } catch {
    return url.length > max ? url.slice(0, max) + "…" : url;
  }
}

/** Rendered inside the dedicated "dev" Tauri window. Mirrors all tracking
 * data broadcast by the main window and shows a sync status per row derived
 * from the current internet connectivity — placeholder until real SQLite
 * sync_status columns are added. */
export function DevSyncScreen() {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState<DevSyncPayload | null>(null);
  const status: SyncStatus = isOnline ? "synced" : "pending";

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onDevData((payload) => setData(payload)).then((fn) => {
      unlisten = fn;
      // Listener is now registered — ask the main window to push current data
      // immediately instead of waiting for the next state change.
      void requestDevData();
    });
    return () => unlisten?.();
  }, []);

  return (
    <div className="flex h-screen flex-col bg-[#141416] text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <span className="text-sm font-semibold tracking-tight">TrackDesk</span>
          <span className="ml-2 text-[11px] text-white/30">Dev Inspector</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/25">Cmd/Ctrl+Shift+D to close</span>
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${
              isOnline
                ? "bg-green-900/40 text-green-400"
                : "bg-yellow-900/40 text-yellow-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isOnline ? "bg-green-400" : "bg-yellow-400"}`} />
            {isOnline ? "Online — data syncs immediately" : "Offline — data queued as pending"}
          </div>
        </div>
      </div>

      {/* No data yet */}
      {!data && (
        <div className="flex flex-1 items-center justify-center text-sm text-white/25">
          Waiting for data — start the timer in the main window
        </div>
      )}

      {/* Four-column grid */}
      {data && (
        <div className="grid flex-1 grid-cols-4 divide-x divide-white/10 overflow-hidden">
          {/* ── Timer ── */}
          <div className="flex flex-col gap-3 overflow-y-auto p-5">
            <SectionHeader title="Timer" count={1} />
            <div className="flex flex-col gap-2 rounded-lg border border-white/8 bg-white/3 p-4">
              <span className="font-mono text-2xl font-semibold tracking-wider text-white">
                {formatElapsed(data.timer.elapsedSeconds)}
              </span>
              <span className="text-[11px] capitalize text-white/40">{data.timer.status}</span>
              <SyncBadge status={status} />
            </div>
          </div>

          {/* ── App Tracking ── */}
          <div className="flex flex-col overflow-y-auto p-5">
            <SectionHeader title="App Tracking" count={data.apps.length} />
            {data.apps.length === 0 ? (
              <EmptyRow label="No apps recorded yet" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.apps.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/3 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="truncate text-[12px] font-medium text-white/90" title={app.appName}>
                        {app.appName}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-white/40">
                        {formatSeconds(app.seconds)}
                      </span>
                    </div>
                    {app.windowTitle && (
                      <span className="truncate text-[10px] text-white/30" title={app.windowTitle}>
                        {app.windowTitle}
                      </span>
                    )}
                    <SyncBadge status={status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── URL Tracking ── */}
          <div className="flex flex-col overflow-y-auto p-5">
            <SectionHeader title="URL Tracking" count={data.urls.length} />
            {data.urls.length === 0 ? (
              <EmptyRow label="No URLs recorded yet — browse while the timer runs" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.urls.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/3 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="truncate text-[12px] font-medium text-white/90"
                        title={entry.url}
                      >
                        {truncateUrl(entry.url)}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-white/40">
                        {formatSeconds(entry.seconds)}
                      </span>
                    </div>
                    {entry.title && (
                      <span className="truncate text-[10px] text-white/30" title={entry.title}>
                        {entry.title}
                      </span>
                    )}
                    <SyncBadge status={status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Screenshots ── */}
          <div className="flex flex-col overflow-y-auto p-5">
            <SectionHeader title="Screenshots" count={data.screenshots.length} />
            {data.screenshots.length === 0 ? (
              <EmptyRow label="No screenshots yet — captured every 2–5 min" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.screenshots.map((shot) => (
                  <div
                    key={shot.id}
                    className="flex flex-col gap-1.5 rounded-lg border border-white/8 bg-white/3 p-3"
                  >
                    {/* Placeholder thumbnail — real image lives in main window */}
                    <div className="flex h-16 items-center justify-center rounded bg-white/5 text-[10px] text-white/20">
                      screenshot
                    </div>
                    <span className="text-[11px] text-white/50">
                      Captured at {formatTime(shot.capturedAt)}
                    </span>
                    <SyncBadge status={status} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="border-t border-white/10 px-6 py-2 text-[10px] text-white/20">
        Sync status is derived from network connectivity. Individual row statuses will come from SQLite sync_status once the local DB is wired up.
      </div>
    </div>
  );
}
