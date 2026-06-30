// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(serde::Serialize)]
struct ActiveWindowInfo {
    app_name: String,
    title: String,
}

/// Returns the currently focused application and window title via OS-level
/// APIs (NSWorkspace on macOS, Win32 on Windows, X11 on Linux).
#[tauri::command]
fn get_active_window() -> Result<ActiveWindowInfo, String> {
    active_win_pos_rs::get_active_window()
        .map(|w| ActiveWindowInfo { app_name: w.app_name, title: w.title })
        .map_err(|_| "no active window".to_string())
}

#[derive(serde::Serialize)]
struct BrowserTabInfo {
    url: String,
    title: String,
}

/// AppleScript snippet that returns "<url><SEP><title>" for the front tab of
/// a given browser. Each browser exposes a slightly different dictionary
/// (Chromium browsers use "active tab of front window"; Safari uses "front
/// document"), so each gets its own template. `{sep}` is substituted with a
/// delimiter unlikely to appear in either string, since osascript has no
/// structured output mode we can parse safely otherwise.
#[cfg(target_os = "macos")]
fn browser_apple_script(app_name: &str) -> Option<String> {
    const SEP: &str = "\u{1f}"; // ASCII unit separator
    let body = match app_name {
        "Google Chrome" | "Brave Browser" | "Microsoft Edge" | "Arc" | "Vivaldi" | "Chromium" => {
            format!(
                r#"tell application "{app}" to tell active tab of front window to return (URL & "{sep}" & title)"#,
                app = app_name,
                sep = SEP,
            )
        }
        "Safari" => format!(
            r#"tell application "Safari" to tell front document to return (URL & "{sep}" & name)"#,
            sep = SEP,
        ),
        _ => return None,
    };
    Some(body)
}

#[cfg(target_os = "macos")]
fn active_browser_tab(app_name: &str) -> Result<BrowserTabInfo, String> {
    let script = browser_apple_script(app_name)
        .ok_or_else(|| "active app is not a supported browser".to_string())?;

    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut parts = stdout.splitn(2, '\u{1f}');
    let url = parts.next().unwrap_or("").to_string();
    let title = parts.next().unwrap_or("").to_string();

    if url.is_empty() {
        return Err("browser returned no URL".to_string());
    }

    Ok(BrowserTabInfo { url, title })
}

#[cfg(not(target_os = "macos"))]
fn active_browser_tab(_app_name: &str) -> Result<BrowserTabInfo, String> {
    Err("browser tab tracking is not supported on this platform".to_string())
}

/// Returns the URL and title of the front tab of `app_name`, if it's a
/// supported browser. The frontend already knows `app_name` from
/// `get_active_window`, so it's passed in rather than re-queried here —
/// avoids a second native focus lookup racing with the first.
#[tauri::command]
fn get_active_browser_tab(app_name: String) -> Result<BrowserTabInfo, String> {
    active_browser_tab(&app_name)
}

/// Seconds since the last system-wide keyboard/mouse/trackpad input, via the
/// same OS-level idle clock screensavers and `pmset` use. Unlike DOM input
/// events, this works no matter which window or app currently has focus, so
/// scrolling/typing in another app still counts as activity.
#[cfg(target_os = "macos")]
fn system_idle_seconds() -> Result<u64, String> {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventSourceSecondsSinceLastEventType(state_id: i32, event_type: u32) -> f64;
    }
    const HID_SYSTEM_STATE: i32 = 1;
    const ANY_INPUT_EVENT_TYPE: u32 = u32::MAX;
    let seconds =
        unsafe { CGEventSourceSecondsSinceLastEventType(HID_SYSTEM_STATE, ANY_INPUT_EVENT_TYPE) };
    Ok(seconds as u64)
}

#[cfg(target_os = "windows")]
fn system_idle_seconds() -> Result<u64, String> {
    #[repr(C)]
    struct LastInputInfo {
        cb_size: u32,
        dw_time: u32,
    }
    extern "system" {
        fn GetLastInputInfo(plii: *mut LastInputInfo) -> i32;
        fn GetTickCount() -> u32;
    }
    let mut info = LastInputInfo { cb_size: std::mem::size_of::<LastInputInfo>() as u32, dw_time: 0 };
    let ok = unsafe { GetLastInputInfo(&mut info) };
    if ok == 0 {
        return Err("GetLastInputInfo failed".to_string());
    }
    let now = unsafe { GetTickCount() };
    Ok((now.wrapping_sub(info.dw_time) / 1000) as u64)
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn system_idle_seconds() -> Result<u64, String> {
    Err("system idle detection is not supported on this platform".to_string())
}

/// Exposes the system-wide idle clock to the frontend so it can detect idle
/// time even while another app has focus.
#[tauri::command]
fn get_system_idle_seconds() -> Result<u64, String> {
    system_idle_seconds()
}

/// Captures the primary monitor and returns the raw PNG bytes. The frontend
/// is responsible for base64-encoding them into a data URL.
#[tauri::command]
fn capture_screenshot() -> Result<Vec<u8>, String> {
    use std::io::Cursor;
    use xcap::Monitor;

    let monitors = Monitor::all().map_err(|e| e.to_string())?;
    let monitor = monitors
        .iter()
        .find(|m| m.is_primary().unwrap_or(false))
        .or_else(|| monitors.first())
        .ok_or_else(|| "no monitor found".to_string())?;

    let image = monitor.capture_image().map_err(|e| e.to_string())?;

    let mut buf = Cursor::new(Vec::new());
    image
        .write_to(&mut buf, image::ImageFormat::Png)
        .map_err(|e| e.to_string())?;

    Ok(buf.into_inner())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            capture_screenshot,
            get_active_window,
            get_active_browser_tab,
            get_system_idle_seconds
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
