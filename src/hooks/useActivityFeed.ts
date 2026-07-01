import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { AppUsageEntry, ScreenshotEntry, UrlUsageEntry } from "../types";

const MAX_SCREENSHOTS = 5;
const MAX_ROWS = 12;
const MIN_CAPTURE_MS = 2 * 60 * 1000;
const MAX_CAPTURE_MS = 5 * 60 * 1000;
const ACTIVE_WINDOW_POLL_MS = 2000;

interface ActiveWindowInfo {
  app_name: string;
  title: string;
}

interface BrowserTabInfo {
  url: string;
  title: string;
}

// Mirrors the browsers `get_active_browser_tab` knows how to handle on the
// Rust side (src-tauri/src/lib.rs) — kept in sync manually since there's no
// shared source of truth across the IPC boundary.
// macOS: bundle display names (from NSWorkspace)
// Windows: exe stem, no extension (from active-win-pos-rs QueryFullProcessImageName)
// Linux: WM_CLASS res_name, lowercase (from active-win-pos-rs via X11)
const BROWSER_APPS = new Set([
  // macOS
  "Google Chrome", "Brave Browser", "Microsoft Edge", "Arc", "Vivaldi", "Chromium", "Safari",
  // Windows
  "chrome", "brave", "msedge", "firefox", "opera", "vivaldi", "chromium",
  // Linux
  "google-chrome", "brave-browser", "microsoft-edge", "firefox", "vivaldi-stable", "chromium-browser",
]);

function randomCaptureDelay() {
  return MIN_CAPTURE_MS + Math.random() * (MAX_CAPTURE_MS - MIN_CAPTURE_MS);
}

let shotIdSeq = 0;
let appIdSeq = 0;
let urlIdSeq = 0;

/** Rust returns raw PNG bytes; chunking avoids blowing the call stack that
 * `String.fromCharCode(...bytes)` would hit on a large screenshot. */
function pngBytesToDataUrl(bytes: Uint8Array) {
  const CHUNK_SIZE = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

/** Tracks real app usage by polling the OS-level focused window (via the
 * Rust `get_active_window` command, NSWorkspace/Win32/X11 under the hood)
 * every `ACTIVE_WINDOW_POLL_MS`, and accumulates seconds per app. When the
 * focused app is a known browser, it also asks the browser itself (via
 * `get_active_browser_tab`: AppleScript on macOS, PowerShell UIAutomation on
 * Windows, AT-SPI2 on Linux) for the front tab's URL/title and accumulates
 * seconds per URL the same way. Also takes real screenshots via
 * `capture_screenshot` on a random 2-5 minute cadence. */
export function useActivityFeed(running: boolean) {
  const [apps, setApps] = useState<AppUsageEntry[]>([]);
  const [urls, setUrls] = useState<UrlUsageEntry[]>([]);
  const [screenshots, setScreenshots] = useState<ScreenshotEntry[]>([]);
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    if (!running) return;

    let appUsageInterval: number | undefined;
    if (isTauri()) {
      let lastTickAt = Date.now();
      appUsageInterval = window.setInterval(async () => {
        const elapsed = (Date.now() - lastTickAt) / 1000;
        lastTickAt = Date.now();
        try {
          const win = await invoke<ActiveWindowInfo>("get_active_window");
          setApps((prev) => {
            const existing = prev.find((a) => a.appName === win.app_name);
            const next = existing
              ? prev.map((a) =>
                  a.appName === win.app_name
                    ? { ...a, windowTitle: win.title, seconds: a.seconds + elapsed }
                    : a,
                )
              : [
                  { id: `app-${(appIdSeq += 1)}`, appName: win.app_name, windowTitle: win.title, seconds: elapsed },
                  ...prev,
                ];
            return next.sort((a, b) => b.seconds - a.seconds).slice(0, MAX_ROWS);
          });

          if (!BROWSER_APPS.has(win.app_name)) return;
          const tab = await invoke<BrowserTabInfo>("get_active_browser_tab", { appName: win.app_name });
          setUrls((prev) => {
            const existing = prev.find((u) => u.url === tab.url);
            const next = existing
              ? prev.map((u) => (u.url === tab.url ? { ...u, title: tab.title, seconds: u.seconds + elapsed } : u))
              : [{ id: `url-${(urlIdSeq += 1)}`, url: tab.url, title: tab.title, seconds: elapsed }, ...prev];
            return next.sort((a, b) => b.seconds - a.seconds).slice(0, MAX_ROWS);
          });
        } catch (err) {
          console.error("TrackDesk: active window/tab lookup failed", err);
        }
      }, ACTIVE_WINDOW_POLL_MS);
    }

    let timeoutId: number;
    const scheduleCapture = () => {
      timeoutId = window.setTimeout(async () => {
        if (!runningRef.current) return;
        try {
          if (isTauri()) {
            const bytes = await invoke<number[]>("capture_screenshot");
            const dataUrl = pngBytesToDataUrl(new Uint8Array(bytes));
            shotIdSeq += 1;
            setScreenshots((prev) => [
              { id: `shot-${shotIdSeq}`, dataUrl, capturedAt: new Date() },
              ...prev,
            ].slice(0, MAX_SCREENSHOTS));
          }
        } catch (err) {
          console.error("TrackDesk: screenshot capture failed", err);
        }
        if (runningRef.current) scheduleCapture();
      }, randomCaptureDelay());
    };
    scheduleCapture();

    return () => {
      window.clearInterval(appUsageInterval);
      window.clearTimeout(timeoutId);
    };
  }, [running]);

  return { apps, urls, screenshots };
}
