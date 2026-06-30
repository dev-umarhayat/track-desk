import { useCallback, useEffect, useRef, useState } from "react";
import type { TimerStatus } from "../types";

export interface UseTimerResult {
  status: TimerStatus;
  elapsedSeconds: number;
  start: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setElapsedSeconds: (seconds: number) => void;
  setStatus: (status: TimerStatus) => void;
}

export function useTimer(initialSeconds = 0): UseTimerResult {
  const [status, setStatus] = useState<TimerStatus>("stopped");
  const [elapsedSeconds, setElapsedSeconds] = useState(initialSeconds);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (status === "running") {
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [status]);

  const start = useCallback(() => setStatus("running"), []);
  const pause = useCallback(() => setStatus("paused"), []);
  const resume = useCallback(() => setStatus("running"), []);
  const stop = useCallback(() => {
    setStatus("stopped");
    setElapsedSeconds(0);
  }, []);

  return { status, elapsedSeconds, start, pause, resume, stop, setElapsedSeconds, setStatus };
}
