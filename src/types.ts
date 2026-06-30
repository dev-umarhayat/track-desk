export type TimerStatus = "running" | "paused" | "stopped";

export type AccountStatus = "active" | "blocked" | "locked" | "archived" | "session_deleted";

export interface Project {
  id: string;
  name: string;
  client: string;
  emoji: string;
}

export interface AppUsageEntry {
  id: string;
  appName: string;
  windowTitle: string;
  seconds: number;
}

export interface UrlUsageEntry {
  id: string;
  url: string;
  title: string;
  seconds: number;
}

export interface ScreenshotEntry {
  id: string;
  dataUrl: string;
  capturedAt: Date;
}

export interface TimeStats {
  todaySeconds: number;
  idleSeconds: number;
  weekSeconds: number;
  monthSeconds: number;
}

export interface IdleEvent {
  startedAt: Date;
  endedAt: Date;
  seconds: number;
}

export interface AuthUser {
  name: string;
  email: string;
  initials: string;
}


export type WidgetAction = "pause" | "resume" | "stop" | "open";

export interface TimerBroadcastPayload {
  status: TimerStatus;
  elapsedSeconds: number;
  lastScreenshot?: ScreenshotEntry;
}
