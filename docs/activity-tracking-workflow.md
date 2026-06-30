# App Usage & Idle Detection Workflow

How TrackDesk tracks which apps the user has focused (and for how long), and how it detects idle time, while the timer is running. Companion to [screenshot-workflow.md](./screenshot-workflow.md), which covers screen captures.

## Overview

```
Rust (src-tauri)                    React frontend (main window)
─────────────────                   ─────────────────────────────
get_active_window()      <-------   useActivityFeed() polls every 2s
  - NSWorkspace (macOS)               while the timer is running
  - Win32 (Windows)         ------>   accumulates elapsed seconds per
  - X11 (Linux)                       appName into apps[] state, sorted
  via active-win-pos-rs               by time spent, capped at 12 rows
                                            |
                                            |  TimerScreen renders
                                            |  "Apps opened · time spent"
                                            v

get_system_idle_seconds() <-------   useIdleDetector() polls every 1s
  - CGEventSourceSecondsSince          while `active` is true
    LastEventType (macOS)    ------>   compares to thresholdSeconds;
  - GetLastInputInfo (Windows)         fires onIdle() once exceeded
```

Both pieces poll Rust commands on an interval rather than relying on browser-level DOM events, because TrackDesk needs to know about activity that happens **outside its own window** — the user working in VS Code, a browser, Figma, etc. — not just inside the Tauri webview.

Nothing is persisted yet — `apps[]` lives only in the main window's React state for the current session and resets on restart, same as screenshots.

## 1. App usage tracking

### Rust side — `get_active_window` (`src-tauri/src/lib.rs`)

```rust
#[tauri::command]
fn get_active_window() -> Result<ActiveWindowInfo, String>
```

- Delegates to the [`active-win-pos-rs`](https://crates.io/crates/active-win-pos-rs) crate, which wraps the OS's "what's focused right now" API: `NSWorkspace`/`CGWindowListCopyWindowInfo` on macOS, Win32 on Windows, X11 on Linux.
- Returns `{ app_name, title }` — the owning app's name (e.g. `"Code"`, `"Google Chrome"`) and the focused window's title.
- **macOS caveat:** window *titles* for windows owned by other processes require Screen Recording permission (the same TCC permission `capture_screenshot` already needs via `xcap`). `app_name` works regardless of that permission; `title` may come back empty without it.

### Frontend side — `src/hooks/useActivityFeed.ts`

```ts
const ACTIVE_WINDOW_POLL_MS = 2000;
```

- While `running` is true and `isTauri()`, an interval fires every 2 seconds:
  1. Computes `elapsed` = seconds since the last tick (not a fixed `2`, so drift/slow ticks are still accounted for accurately).
  2. Calls `invoke<ActiveWindowInfo>("get_active_window")`.
  3. Looks up an existing entry in `apps[]` by `appName`. If found, adds `elapsed` to its `seconds` and refreshes `windowTitle` to whatever's currently focused for that app. If not found, prepends a new `AppUsageEntry`.
  4. Re-sorts the array by `seconds` descending and caps it at `MAX_ROWS` (12), so the busiest apps stay visible and the list doesn't grow unbounded.
- This is **not** a fallback/mock — outside Tauri (e.g. `npm run dev` in a plain browser) there is no native window to query, so app tracking simply doesn't run; only the `isTauri()` branch is wired up.
- URL tracking (`urls[]`) is still simulated via `randomUrlUsage()` in `src/lib/mock.ts` — there's no native hook for "which URL is the active browser tab on" without a browser extension, so that part of the feed is unchanged from the original mock.

### Storage shape — `src/types.ts`

```ts
export interface AppUsageEntry {
  id: string;
  appName: string;
  windowTitle: string;
  seconds: number;
}
```

Unchanged from the mock version — only how entries get created and accumulated changed, not the shape consumed by `TimerScreen`'s `ActivityList`.

### Display — `src/screens/TimerScreen.tsx`

```tsx
<ActivityList
  title="Apps opened · time spent"
  items={apps}
  render={(a) => ({ primary: a.appName, secondary: a.windowTitle })}
/>
```

No changes needed here — `ActivityList` just renders whatever `apps[]` contains, sorted, with `formatHM(item.seconds)` next to each row.

## 2. Idle detection

### Rust side — `get_system_idle_seconds` (`src-tauri/src/lib.rs`)

```rust
#[tauri::command]
fn get_system_idle_seconds() -> Result<u64, String>
```

Returns seconds since the last system-wide keyboard/mouse/trackpad input — the same idle clock macOS screensavers and `pmset` use, **not** scoped to any particular window or app:

- **macOS:** calls `CGEventSourceSecondsSinceLastEventType(kCGEventSourceStateHIDSystemState, kCGAnyInputEventType)` via a direct `extern "C"` binding into the `CoreGraphics` framework (no extra crate needed for this one call).
- **Windows:** calls `GetLastInputInfo` + `GetTickCount` from `user32`/`kernel32` via `extern "system"`, computing `(now - last_input_tick) / 1000`.
- **Linux/other:** returns `Err(...)` — there's no single portable equivalent wired up yet (would need an X11/Wayland-specific idle extension), so the frontend's fallback path (below) takes over there.

### Frontend side — `src/hooks/useIdleDetector.ts`

```ts
const SYSTEM_IDLE_POLL_MS = 1000;
```

- While `active` is true **and** `isTauri()`: polls `get_system_idle_seconds` every second, sets `idleSeconds` directly from the returned value (it's already a running total from the OS, not something this hook needs to increment itself), and fires `onIdle(seconds)` once it crosses `thresholdSeconds` — same one-shot-until-reset behavior as before (`firedRef`).
- If the command errors (e.g. unsupported platform), it logs once and **does not** fall through into the DOM-listener path automatically within the same effect run — see [Known gap](#known-gap-no-mid-session-fallback) below.
- Outside Tauri (browser dev preview): falls back to the original approach — DOM listeners on `window` (`mousemove`, `keydown`, `wheel`, `scroll`, `pointermove`, etc.) reset a local counter that an interval increments every second.

**Why this fixes the "idle while scrolling elsewhere" bug:** the original implementation only listened for DOM events fired on TrackDesk's own webview window. Scrolling or typing in another app never dispatches events there, so the app was eventually flagged idle even though the user was actively working — just not inside TrackDesk. Polling the OS-level idle clock instead means *any* input anywhere on the machine resets the counter.

### Known gap: no mid-session fallback

If `get_system_idle_seconds` starts failing partway through a Tauri session (e.g. on an unsupported Linux desktop), the current code only logs the error — it doesn't switch to the DOM-listener path until the component remounts (e.g. timer stopped and restarted). This is acceptable for now since macOS/Windows (the supported paths) don't fail at runtime once compiled, but is worth revisiting if Linux support matters.

## Future: backend integration

Same status as screenshots — see [screenshot-workflow.md § Future: backend integration](./screenshot-workflow.md#future-backend-integration). App usage and idle events would need to be uploaded to the Django backend alongside screenshots, scoped to the authenticated user/organization, instead of (or in addition to) living only in the main window's in-memory `apps[]` array.
