import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { TrayIcon, type TrayIcon as TrayIconType } from "@tauri-apps/api/tray";
import { Menu, type MenuItemOptions, type PredefinedMenuItemOptions } from "@tauri-apps/api/menu";
import { Image } from "@tauri-apps/api/image";
import { LogicalPosition } from "@tauri-apps/api/dpi";
import { getCurrentWindow, primaryMonitor } from "@tauri-apps/api/window";
import type { AccountStatus, TimerStatus, WidgetAction } from "../types";
import { emitWidgetAction } from "./tauriBridge";

/** macOS hides a tray item that has no icon (and no title), so the tray is
 * created with the bundled app icon — without this it silently renders nothing
 * in the menu bar even though the TrayIcon object exists. */
async function loadTrayIcon() {
  const res = await fetch("/tray-icon.png");
  const bytes = new Uint8Array(await res.arrayBuffer());
  return Image.fromBytes(bytes);
}

/** Shows the floating "always on top" widget window, parked in the bottom-right
 * corner of the primary monitor, mirroring Hubstaff's floating timer overlay. */
export async function showFloatingWidget() {
  if (!isTauri()) return;
  const widget = await WebviewWindow.getByLabel("widget");
  if (!widget) return;
  try {
    const monitor = await primaryMonitor();
    if (monitor) {
      const { width, height } = monitor.size;
      const margin = 24;
      await widget.setPosition(
        new LogicalPosition(
          width / monitor.scaleFactor - 232 - margin,
          height / monitor.scaleFactor - 150 - margin,
        ),
      );
    }
  } catch {
    // best-effort positioning only
  }
  await widget.show();
}

export async function hideFloatingWidget() {
  if (!isTauri()) return;
  const widget = await WebviewWindow.getByLabel("widget");
  await widget?.hide();
}

export async function focusMainWindow() {
  if (!isTauri()) return;
  const main = await WebviewWindow.getByLabel("main");
  await main?.show();
  await main?.setFocus();
}

interface TraySetupOptions {
  onAction: (action: WidgetAction) => void;
  onSignOut: () => void;
  onQuit: () => void;
}

export interface TrayMenuState {
  isAuthenticated: boolean;
  accountStatus: AccountStatus;
  timerStatus: TimerStatus;
}

let traySetupOptions: TraySetupOptions | null = null;

function buildTrayMenuItems(
  state: TrayMenuState,
  { onAction, onSignOut, onQuit }: TraySetupOptions,
): (MenuItemOptions | PredefinedMenuItemOptions)[] {
  const separator: PredefinedMenuItemOptions = { item: "Separator" };
  const openItem: MenuItemOptions = { id: "open", text: "Open TrackDesk", action: () => void focusMainWindow() };
  const quitItem: MenuItemOptions = { id: "quit", text: "Quit TrackDesk", action: onQuit };

  if (!state.isAuthenticated) {
    return [openItem, separator, quitItem];
  }

  if (state.accountStatus !== "active") {
    return [openItem, separator, { id: "signout", text: "Sign out", action: onSignOut }, quitItem];
  }

  return [
    state.timerStatus === "running"
      ? { id: "pause", text: "Pause timer", action: () => onAction("pause") }
      : { id: "resume", text: "Resume timer", action: () => onAction("resume") },
    { id: "stop", text: "Stop timer", action: () => onAction("stop") },
    separator,
    openItem,
    { id: "stats", text: "My stats today", action: () => void focusMainWindow() },
    separator,
    { id: "signout", text: "Sign out", action: onSignOut },
    quitItem,
  ];
}

/** Builds the native system tray icon + dropdown menu entirely from the
 * frontend using the Tauri v2 JS menu/tray APIs (no Rust command needed).
 *
 * Tray setup is async (icon fetch + a few IPC round trips), so a plain
 * `if (trayHandle) return` guard isn't enough — React (StrictMode, fast
 * re-renders) can call this twice before the first call's promise settles,
 * which used to create two tray icons. Caching the in-flight promise itself
 * makes concurrent callers await the same creation instead of starting a
 * second one. */
let trayPromise: Promise<TrayIconType | null> | null = null;

export async function setupSystemTray(state: TrayMenuState, options: TraySetupOptions) {
  if (!isTauri()) return null;
  traySetupOptions = options;
  if (trayPromise) return trayPromise;

  trayPromise = (async () => {
    const menu = await Menu.new({ items: buildTrayMenuItems(state, options) });

    const icon = await loadTrayIcon().catch((err) => {
      console.error("TrackDesk: failed to load tray icon, tray may render blank", err);
      return undefined;
    });

    return TrayIcon.new({
      id: "track-desk-tray",
      menu,
      icon,
      iconAsTemplate: true,
      tooltip: "TrackDesk",
      action: (event) => {
        if (event.type === "DoubleClick") void focusMainWindow();
      },
    });
  })();

  return trayPromise;
}

/** Rebuilds the tray dropdown to reflect the current auth/timer state —
 * e.g. hides timer controls and shows "Sign out" once a session ends. */
export async function updateTrayMenu(state: TrayMenuState) {
  if (!isTauri() || !trayPromise || !traySetupOptions) return;
  const tray = await trayPromise;
  if (!tray) return;
  const menu = await Menu.new({ items: buildTrayMenuItems(state, traySetupOptions) });
  await tray.setMenu(menu);
}

/** Opens the dev inspector window if hidden, hides it if visible.
 * Only call this in dev builds — the window exists in all builds but there
 * is no way to reach it in production without this shortcut. */
export async function toggleDevWindow() {
  if (!isTauri()) return;
  const devWin = await WebviewWindow.getByLabel("dev");
  if (!devWin) {
    console.error("TrackDesk: dev window not found — check tauri.conf.json has label 'dev'");
    return;
  }
  const visible = await devWin.isVisible();
  if (visible) await devWin.hide();
  else await devWin.show();
}

export async function broadcastWidgetAction(action: WidgetAction) {
  await emitWidgetAction(action);
}

export async function getMainWindowHandle() {
  if (!isTauri()) return null;
  return getCurrentWindow();
}

export async function quitApp() {
  if (!isTauri()) return;
  await getCurrentWindow().close();
}
