import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface UseIdleDetectorOptions {
  active: boolean;
  thresholdSeconds: number;
  onIdle: (idleSeconds: number) => void;
}

const SYSTEM_IDLE_POLL_MS = 1000;

/** Fires `onIdle` once `thresholdSeconds` pass without any system-wide
 * keyboard/mouse/trackpad input, while `active` is true. Polls the OS-level
 * idle clock (`get_system_idle_seconds`, the same one screensavers use), so
 * scrolling/typing in another app — not just this window — counts as
 * activity. */
export function useIdleDetector({ active, thresholdSeconds, onIdle }: UseIdleDetectorOptions) {
  const [idleSeconds, setIdleSeconds] = useState(0);
  const firedRef = useRef(false);
  const onIdleRef = useRef(onIdle);
  onIdleRef.current = onIdle;

  useEffect(() => {
    if (!active) {
      setIdleSeconds(0);
      firedRef.current = false;
      return;
    }

    let cancelled = false;

    const poll = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const seconds = await invoke<number>("get_system_idle_seconds");
        if (cancelled) return;
        setIdleSeconds(seconds);
        if (seconds >= thresholdSeconds && !firedRef.current) {
          firedRef.current = true;
          onIdleRef.current(seconds);
        } else if (seconds < thresholdSeconds) {
          firedRef.current = false;
        }
      } catch (err) {
        console.error("TrackDesk: system idle lookup failed", err);
      }
    }, SYSTEM_IDLE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [active, thresholdSeconds]);

  const resetIdle = () => {
    firedRef.current = false;
    setIdleSeconds(0);
  };

  return { idleSeconds, resetIdle };
}
