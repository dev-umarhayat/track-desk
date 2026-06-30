import { isTauri } from "@tauri-apps/api/core";
import { emit, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { TimerBroadcastPayload, WidgetAction } from "../types";

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

export async function onWidgetAction(
  cb: (action: WidgetAction) => void,
): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};
  return listen<{ action: WidgetAction }>(WIDGET_ACTION_EVENT, (e) => cb(e.payload.action));
}
