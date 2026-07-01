import { isTauri } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { AppUsageEntry, TimerBroadcastPayload, TimerStatus, UrlUsageEntry, WidgetAction } from "../types";

/** Payload broadcast from the main window to the dev inspector window.
 * Screenshots carry only metadata (no dataUrl) to keep IPC payloads small. */
export interface DevSyncPayload {
  timer: { status: TimerStatus; elapsedSeconds: number };
  apps: AppUsageEntry[];
  urls: UrlUsageEntry[];
  screenshots: Array<{ id: string; capturedAt: string }>;
}

const TIMER_EVENT = "td://timer";
const WIDGET_ACTION_EVENT = "td://widget-action";

/** Broadcasts the canonical timer state (owned by the main window) to any
 * other windows, e.g. the floating widget, which render-only mirror it. */
export async function broadcastTimerState(payload: TimerBroadcastPayload) {
  if (!isTauri()) return;
  await emit(TIMER_EVENT, payload);
}

export async function onTimerState(
  cb: (payload: TimerBroadcastPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<TimerBroadcastPayload>(TIMER_EVENT, (e) => cb(e.payload));
}

/** Sent by the widget (or native tray menu) when the user triggers an action;
 * the main window listens and applies it to the real timer state. */
export async function emitWidgetAction(action: WidgetAction) {
  if (!isTauri()) return;
  await emit(WIDGET_ACTION_EVENT, { action });
}

const DEV_DATA_EVENT = "td://dev-data";
const DEV_REQUEST_EVENT = "td://dev-request";

/** Broadcasts all current tracking state to the dev inspector window.
 * Only called in dev builds; gating is the caller's responsibility. */
export async function broadcastDevData(payload: DevSyncPayload) {
  if (!isTauri()) return;
  await emit(DEV_DATA_EVENT, payload);
}

export async function onDevData(
  cb: (payload: DevSyncPayload) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<DevSyncPayload>(DEV_DATA_EVENT, (e) => cb(e.payload));
}

/** Sent by the dev window once its listener is registered, so the main window
 * can respond immediately rather than waiting for the next state change. */
export async function requestDevData() {
  if (!isTauri()) return;
  await emit(DEV_REQUEST_EVENT);
}

export async function onDevRequest(cb: () => void): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen(DEV_REQUEST_EVENT, () => cb());
}

export async function onWidgetAction(
  cb: (action: WidgetAction) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<{ action: WidgetAction }>(WIDGET_ACTION_EVENT, (e) => cb(e.payload.action));
}
