# Screenshot Capture Workflow

How TrackDesk captures, stores, and displays screenshots while the timer is running.

## Overview

```
Rust (src-tauri)              React frontend (main window)         React frontend (widget window)
─────────────────             ─────────────────────────────        ──────────────────────────────
capture_screenshot()  <----   useActivityFeed() schedules
  - grabs primary monitor       a random 2-5 min timer
  - encodes PNG          ---->  and calls invoke(...)
  - returns raw bytes           base64-encodes bytes into
                                 a data URL, stores it in
                                 screenshots[] state
                                      |
                                      |  TimerScreen renders
                                      |  ScreenshotStrip (thumbnails)
                                      |
                                      v
                                broadcastTimerState() emits
                                "td://timer" event with
                                lastScreenshot attached    ---->  WidgetWindow listens,
                                                                   revives Date, passes to
                                                                   FloatingWidget (thumbnail)
```

Nothing is persisted yet — screenshots live only in the main window's React state for the current session and are lost on restart. There's no backend involved at this stage (see [Future: backend integration](#future-backend-integration)).

## 1. Capture — Rust side (`src-tauri/src/lib.rs`)

```rust
#[tauri::command]
fn capture_screenshot() -> Result<Vec<u8>, String>
```

- Uses the [`xcap`](https://crates.io/crates/xcap) crate to enumerate monitors (`Monitor::all()`) and picks the primary one (falls back to the first if none is flagged primary).
- `monitor.capture_image()` returns an `RgbaImage` (raw pixel buffer) — this is the actual OS-level screen grab; everything before this point is just monitor selection.
- The `image` crate encodes that buffer to PNG in memory (`image.write_to(&mut buf, ImageFormat::Png)`), avoiding a temp file.
- The function returns the raw PNG bytes as-is (`Vec<u8>`); base64-encoding into a data URL is the frontend's job (see below).

**Why bytes instead of a data URL:** keeps Rust focused on capturing pixels, not on formatting strings for a particular display use case. The frontend still needs a `data:image/png;base64,...` string to drop into `<img src=...>`, so it does that encode itself via `btoa`.

The command is registered in `invoke_handler![...]` in the same file — no capability/ACL entry is needed because custom `#[tauri::command]`s aren't permission-gated the way plugin commands are.

## 2. Scheduling — `src/hooks/useActivityFeed.ts`

```ts
const MIN_CAPTURE_MS = 2 * 60 * 1000;
const MAX_CAPTURE_MS = 5 * 60 * 1000;
```

- Instead of a fixed `setInterval`, capture uses a **recursive `setTimeout`**: after each capture (or attempt), it schedules the next one with a fresh random delay between 2 and 5 minutes. A fixed interval would make captures predictable; randomizing mimics how tools like Hubstaff avoid a guessable cadence.
- Only runs while `running` (the timer hook's `running` flag) is true. A `runningRef` mirrors the latest value into the timeout's closure so a capture that's mid-flight when the timer stops won't get rescheduled.
- Calls `invoke<number[]>("capture_screenshot")` only when `isTauri()` is true — in a plain browser dev session (`npm run dev` outside the Tauri shell) there's no Rust backend to call, so it's skipped silently rather than throwing.
- The result is the raw PNG bytes (Tauri's IPC ships `Vec<u8>` as a JSON array of numbers). `pngBytesToDataUrl()` wraps it in a `Uint8Array` and base64-encodes it via `btoa`, chunking 32KB at a time so `String.fromCharCode(...bytes)` doesn't blow the call stack on a large screenshot.
- On success, prepends a new `ScreenshotEntry { id, dataUrl, capturedAt }` to React state, capped at `MAX_SCREENSHOTS` (oldest dropped).

## 3. Storage shape — `src/types.ts`

```ts
export interface ScreenshotEntry {
  id: string;
  dataUrl: string;
  capturedAt: Date;
}
```

This replaced the old mock shape (`{ id, appName, capturedAt }`) — `appName` was only ever a label for the fake gradient placeholder; the real screenshot has no inherent "app name," just pixels.

## 4. Display in the main window — `ScreenshotStrip.tsx`

`TimerScreen` already received `screenshots: ScreenshotEntry[]` and passes it to `ScreenshotStrip`. The strip renders up to 3 thumbnails:

```tsx
<img src={s.dataUrl} alt="Screenshot" className="h-full w-full object-cover" />
```

with a timestamp badge (`formatClock`) overlaid in the corner. No changes were needed to the data flow here — only to what's rendered inside each thumbnail.

## 5. Display in the floating widget — cross-window relay

The floating widget is a **separate Tauri window** (`widget` in `tauri.conf.json`) rendered by `WidgetWindow.tsx`, not by the main window's React tree. It has no access to `useActivityFeed`'s state directly — it only knows what the main window broadcasts.

- `TimerBroadcastPayload` (in `types.ts`) gained an optional `lastScreenshot?: ScreenshotEntry` field.
- `App.tsx` includes `screenshots[0]` every time it calls `broadcastTimerState(...)`, so the widget always has the latest capture.
- **Gotcha:** Tauri's `emit`/`listen` event bridge JSON-serializes the payload to cross the window/process boundary. A JS `Date` doesn't survive that — it arrives as an ISO string. `WidgetWindow.tsx` explicitly revives it:

  ```ts
  lastScreenshot: payload.lastScreenshot
    ? { ...payload.lastScreenshot, capturedAt: new Date(payload.lastScreenshot.capturedAt) }
    : undefined,
  ```

  Skipping this would silently break `timeAgo()`/`formatClock()` calls in `FloatingWidget`, since they call `.getTime()` on what they assume is a `Date`.
- `FloatingWidget.tsx` renders the thumbnail the same way as the strip, falling back to the camera icon when there's no capture yet (`lastScreenshot` undefined — e.g. right after the timer starts, before the first random delay elapses).

## Future: backend integration

This workflow only covers the "front end" half. The intended next step (discussed but not yet built):

1. Desktop app authenticates against a Django backend; auth token identifies the user (and their organization) for every request.
2. Instead of (or in addition to) keeping screenshots in the `screenshots[]` array, the frontend uploads each capture to a Django endpoint (e.g. `POST /api/screenshots/`) with metadata (timer session id, project id, captured_at).
3. Django attaches `user`/`organization` from the authenticated request — the client never declares its own identity — and stores the image (filesystem or S3) plus a DB row.
4. A separate React admin panel, talking to the same Django API, lets an org admin view screenshots scoped to their organization only.

None of that is implemented yet; this doc only describes the local-only capture → in-memory array → display pipeline that exists today.
