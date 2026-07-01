import { useEffect, useRef, useState } from "react";
import { LoginScreen } from "./screens/LoginScreen";
import { TimerScreen } from "./screens/TimerScreen";
import { IdlePromptScreen } from "./screens/IdlePromptScreen";
import { BlockedScreen } from "./screens/BlockedScreen";
import { useTimer } from "./hooks/useTimer";
import { useIdleDetector } from "./hooks/useIdleDetector";
import { useActivityFeed } from "./hooks/useActivityFeed";
import { broadcastDevData, broadcastTimerState, onDevRequest, onWidgetAction } from "./lib/tauriBridge";
import { focusMainWindow, hideFloatingWidget, quitApp, setupSystemTray, showFloatingWidget, toggleDevWindow, updateTrayMenu } from "./lib/nativeShell";
import { isTauri } from "@tauri-apps/api/core";
import type { AccountStatus, AuthUser, TimeStats } from "./types";
import "./App.css";

const BASE_STATS: TimeStats = { todaySeconds: 0, idleSeconds: 0, weekSeconds: 80040, monthSeconds: 311400 };
const IDLE_THRESHOLD_SECONDS = 60;

function nameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  return localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function initialsFromName(name: string) {
  const words = name.split(" ").filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0]?.slice(0, 2) ?? "U").toUpperCase();
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatus>("active");
  const [blockedAt, setBlockedAt] = useState(new Date());
  const [idleSeconds, setIdleSeconds] = useState(0);
  const [idleEvent, setIdleEvent] = useState<{ startedAt: Date } | null>(null);
  const [widgetVisible, setWidgetVisible] = useState(false);

  const timer = useTimer();
  const isActive = isAuthenticated && accountStatus === "active";
  const { apps, urls, screenshots } = useActivityFeed(isActive && timer.status === "running");

  useIdleDetector({
    active: isActive && timer.status === "running",
    thresholdSeconds: IDLE_THRESHOLD_SECONDS,
    onIdle: (seconds) => {
      const startedAt = new Date(Date.now() - seconds * 1000);
      timer.pause();
      setIdleEvent({ startedAt });
    },
  });

  // Broadcast canonical timer state to the floating widget window.
  useEffect(() => {
    broadcastTimerState({
      status: timer.status,
      elapsedSeconds: timer.elapsedSeconds,
      lastScreenshot: screenshots[0],
    });
  }, [timer.status, timer.elapsedSeconds, screenshots]);

  // Apply actions sent back from the widget / tray.
  const handlersRef = useRef({ pause: timer.pause, resume: timer.resume, stop: timer.stop, signOut: handleSignOut });
  handlersRef.current = { pause: timer.pause, resume: timer.resume, stop: timer.stop, signOut: handleSignOut };

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onWidgetAction((action) => {
      if (action === "pause") handlersRef.current.pause();
      if (action === "resume") handlersRef.current.resume();
      if (action === "stop") handlersRef.current.stop();
      if (action === "open") void focusMainWindow();
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  // Set up the real native system tray once.
  useEffect(() => {
    if (!isTauri()) return;
    setupSystemTray(
      { isAuthenticated, accountStatus, timerStatus: timer.status },
      {
        onAction: (action) => {
          if (action === "pause") handlersRef.current.pause();
          if (action === "resume") handlersRef.current.resume();
          if (action === "stop") handlersRef.current.stop();
          if (action === "open") void focusMainWindow();
        },
        onSignOut: () => handlersRef.current.signOut(),
        onQuit: () => void quitApp(),
      },
    ).catch((err) => console.error("TrackDesk: failed to set up system tray", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the tray menu in sync with auth/timer state (e.g. hide timer controls
  // once signed out, swap "Pause" for "Resume" when paused).
  useEffect(() => {
    if (!isTauri()) return;
    updateTrayMenu({ isAuthenticated, accountStatus, timerStatus: timer.status }).catch((err) =>
      console.error("TrackDesk: failed to update tray menu", err),
    );
  }, [isAuthenticated, accountStatus, timer.status]);

  // Tracking should be visible at a glance — show the floating widget
  // automatically whenever the timer starts running.
  useEffect(() => {
    if (isActive && timer.status === "running") {
      setWidgetVisible(true);
      void showFloatingWidget();
    }
  }, [isActive, timer.status]);

  // Always-current snapshot of tracking data for the dev window. Using a ref
  // means the request handler below never closes over stale state.
  const devPayloadRef = useRef<Parameters<typeof broadcastDevData>[0] | null>(null);

  // Rebuild the snapshot and push it to the dev window on every state change.
  // Only runs in dev builds — zero production overhead.
  useEffect(() => {
    if (!import.meta.env.DEV || !isTauri()) return;
    const payload = {
      timer: { status: timer.status, elapsedSeconds: timer.elapsedSeconds },
      apps,
      urls,
      screenshots: screenshots.map((s) => ({ id: s.id, capturedAt: s.capturedAt.toISOString() })),
    };
    devPayloadRef.current = payload;
    void broadcastDevData(payload);
  }, [timer.status, timer.elapsedSeconds, apps, urls, screenshots]);

  // When the dev window opens it emits td://dev-request once its listener is
  // ready. Respond immediately with the latest snapshot so it doesn't have to
  // wait for the next state change.
  useEffect(() => {
    if (!import.meta.env.DEV || !isTauri()) return;
    let unlisten: (() => void) | undefined;
    onDevRequest(() => {
      if (devPayloadRef.current) void broadcastDevData(devPayloadRef.current);
    }).then((fn) => { unlisten = fn; });
    return () => unlisten?.();
  }, []);


  function handleLogin(email: string, status: AccountStatus) {
    const name = nameFromEmail(email) || "User";
    setUser({ name, email, initials: initialsFromName(name) });
    setAccountStatus(status);
    setIsAuthenticated(true);
    if (status !== "active") {
      setBlockedAt(new Date());
    } else {
      timer.start();
    }
  }

  function handleSignOut() {
    timer.stop();
    setAccountStatus("active");
    setUser(null);
    setIsAuthenticated(false);
    setIdleEvent(null);
    setWidgetVisible(false);
    void hideFloatingWidget();
  }

  function handleKeepIdle() {
    if (idleEvent) {
      const elapsed = Math.round((Date.now() - idleEvent.startedAt.getTime()) / 1000);
      setIdleSeconds((s) => s + elapsed);
      // Timer is NOT adjusted — idle period counts as worked time.
    }
    setIdleEvent(null);
    timer.resume();
  }

  function handleDiscardIdle() {
    if (idleEvent) {
      const elapsed = Math.round((Date.now() - idleEvent.startedAt.getTime()) / 1000);
      setIdleSeconds((s) => s + elapsed);
      // Subtract idle time from the work timer — user chose not to count it.
      timer.setElapsedSeconds(Math.max(0, timer.elapsedSeconds - elapsed));
    }
    setIdleEvent(null);
    timer.resume();
  }

  function handleToggleWidget() {
    if (widgetVisible) void hideFloatingWidget();
    else void showFloatingWidget();
    setWidgetVisible((v) => !v);
  }

  const stats: TimeStats = { ...BASE_STATS, idleSeconds };

  if (!isAuthenticated || !user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#141416] px-3 py-10">
        <LoginScreen onLogin={handleLogin} />
      </main>
    );
  }

  if (accountStatus !== "active") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#141416] px-3 py-10">
        <BlockedScreen accountStatus={accountStatus} blockedAt={blockedAt} />
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center bg-[#141416] px-3 py-10">
      <TimerScreen
        user={user}
        status={timer.status}
        elapsedSeconds={timer.elapsedSeconds}
        onPause={timer.pause}
        onResume={timer.resume}
        onStop={timer.stop}
        onSignOut={handleSignOut}
        onOpenDev={import.meta.env.DEV ? () => toggleDevWindow().catch(console.error) : undefined}
        widgetVisible={widgetVisible}
        onToggleWidget={handleToggleWidget}
        stats={stats}
        apps={apps}
        urls={urls}
        screenshots={screenshots}
      />

      {idleEvent && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 px-3 backdrop-blur-sm">
          <IdlePromptScreen
            idleStartedAt={idleEvent.startedAt}
            onKeep={handleKeepIdle}
            onDiscard={handleDiscardIdle}
          />
        </div>
      )}
    </main>
  );
}
