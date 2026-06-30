import { useEffect, useState } from "react";
import { FloatingWidget } from "../components/FloatingWidget";
import { onTimerState, emitWidgetAction } from "../lib/tauriBridge";
import { hideFloatingWidget } from "../lib/nativeShell";
import type { TimerBroadcastPayload } from "../types";
import "../App.css";

/** Rendered inside the dedicated always-on-top "widget" Tauri window. It owns
 * no state itself — it mirrors whatever the main window broadcasts and sends
 * button clicks back as actions, since the main window is the single source
 * of truth for the timer. */
export function WidgetWindow() {
  const [state, setState] = useState<TimerBroadcastPayload>({
    status: "stopped",
    elapsedSeconds: 0,
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onTimerState((payload) => {
      // Tauri's event bridge JSON-serializes the payload, so dates arrive as
      // strings here and need to be revived before formatting them.
      setState({
        ...payload,
        lastScreenshot: payload.lastScreenshot
          ? { ...payload.lastScreenshot, capturedAt: new Date(payload.lastScreenshot.capturedAt) }
          : undefined,
      });
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);


  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent p-2">
      <FloatingWidget
        status={state.status}
        elapsedSeconds={state.elapsedSeconds}
        lastScreenshot={state.lastScreenshot}
        onPause={() => emitWidgetAction("pause")}
        onResume={() => emitWidgetAction("resume")}
        onStop={() => emitWidgetAction("stop")}
        onClose={() => void hideFloatingWidget()}
      />
    </div>
  );
}
