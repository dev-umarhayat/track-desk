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

/// Reads the front tab URL/title of the focused browser window on Windows via
/// PowerShell UIAutomation — walks the accessibility tree to the omnibox Edit
/// control, which holds the full URL even when the bar is not focused.
/// Spawning powershell takes ~200-400 ms; acceptable at a 2 s poll cadence.
#[cfg(target_os = "windows")]
fn active_browser_tab(app_name: &str) -> Result<BrowserTabInfo, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    // active-win-pos-rs returns the exe stem on Windows ("chrome", "msedge", …)
    let process_name = match app_name {
        "chrome" | "Google Chrome" => "chrome",
        "brave" | "Brave Browser" => "brave",
        "msedge" | "Microsoft Edge" => "msedge",
        "firefox" | "Mozilla Firefox" | "Firefox" => "firefox",
        "opera" => "opera",
        "vivaldi" | "Vivaldi" => "vivaldi",
        "chromium" | "Chromium" => "chromium",
        _ => return Err("not a supported browser".to_string()),
    };

    let script = format!(
        r#"Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes
$p = Get-Process "{proc}" -EA SilentlyContinue | Where-Object {{$_.MainWindowHandle -ne 0}} | Select-Object -First 1
if (-not $p) {{exit 1}}
$root = [System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
if (-not $root) {{exit 1}}
$cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)
$bar = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants,$cond)
if (-not $bar) {{exit 1}}
$v = $bar.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$url = $v.Current.Value
if ([string]::IsNullOrEmpty($url)) {{exit 1}}
if (-not ($url.StartsWith("http://") -or $url.StartsWith("https://") -or $url.StartsWith("file://"))) {{
    if ($url.Contains(".") -and -not $url.Contains(" ")) {{
        $url = "https://" + $url
    }} else {{
        exit 1
    }}
}}
Write-Output ($url + [char]0x1f + $root.Current.Name)"#,
        proc = process_name
    );

    let output = std::process::Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["-NoProfile", "-NonInteractive", "-Command", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err("could not read browser URL".to_string());
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut parts = stdout.splitn(2, '\u{1f}');
    let url = parts.next().unwrap_or("").trim().to_string();
    let title = parts.next().unwrap_or("").trim().to_string();

    if url.is_empty() {
        return Err("browser returned no URL".to_string());
    }

    Ok(BrowserTabInfo { url, title })
}

/// Reads the front tab URL/title on Linux via AT-SPI2 (the accessibility bus
/// pre-installed on Ubuntu/GNOME). Requires python3-gi, which ships by default
/// on all Ubuntu desktop images. Falls back gracefully if unavailable.
#[cfg(target_os = "linux")]
fn active_browser_tab(app_name: &str) -> Result<BrowserTabInfo, String> {
    // active-win-pos-rs returns the WM_CLASS res_name on Linux, which is the
    // lowercase process/app identifier. Map to the AT-SPI display name so the
    // Python script can match the application node in the accessibility tree.
    let atspi_name = match app_name {
        "google-chrome" | "Google Chrome" | "chrome" => "google chrome",
        "chromium" | "chromium-browser" | "Chromium" => "chromium",
        "brave-browser" | "brave" | "Brave Browser" => "brave browser",
        "microsoft-edge" | "Microsoft Edge" => "microsoft edge",
        "firefox" | "Firefox" | "Firefox Web Browser" | "Mozilla Firefox" => "firefox",
        "opera" => "opera",
        "vivaldi-stable" | "vivaldi" | "Vivaldi" => "vivaldi",
        _ => return Err("not a supported browser".to_string()),
    };

    let script = format!(
        r#"import sys
try:
    import gi; gi.require_version('Atspi','2.0')
    from gi.repository import Atspi
except Exception as e:
    sys.stderr.write('AT-SPI2 unavailable: '+str(e)+'\n'); sys.exit(1)
SEP='\x1f'
TARGET='{name}'
def find_url_bar(node,depth=0):
    if depth>12: return None
    try:
        role=node.get_role()
        if role in(Atspi.Role.ENTRY,Atspi.Role.TEXT):
            val=''
            try: val=node.get_text(0,-1)or''
            except Exception: pass
            if val.startswith(('http://','https://','file://')): return node
            nm=(node.get_name()or'').lower()
            ds=(node.get_description()or'').lower()
            if any(k in nm or k in ds for k in('address','location','url','search','omnibox')):
                if val: return node
        for i in range(node.get_child_count()):
            r=find_url_bar(node.get_child(i),depth+1)
            if r: return r
    except Exception: pass
    return None
desktop=Atspi.get_desktop(0)
for i in range(desktop.get_child_count()):
    try:
        app=desktop.get_child(i)
        if not app: continue
        aname=(app.get_name()or'').lower()
        if TARGET not in aname and aname not in TARGET: continue
        bar=find_url_bar(app)
        if not bar: continue
        url=bar.get_text(0,-1)or''
        if not url.startswith(('http://','https://','file://')): continue
        win=None
        for j in range(app.get_child_count()):
            try:
                w=app.get_child(j)
                if w and w.get_role()==Atspi.Role.FRAME: win=w; break
            except Exception: pass
        title=(win.get_name()if win else app.get_name())or''
        print(url+SEP+title); sys.exit(0)
    except Exception: continue
sys.exit(1)
"#,
        name = atspi_name
    );

    let output = std::process::Command::new("python3")
        .args(["-c", &script])
        .output()
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            "could not read browser URL".to_string()
        } else {
            stderr
        });
    }

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut parts = stdout.splitn(2, '\u{1f}');
    let url = parts.next().unwrap_or("").trim().to_string();
    let title = parts.next().unwrap_or("").trim().to_string();

    if url.is_empty() {
        return Err("browser returned no URL".to_string());
    }

    Ok(BrowserTabInfo { url, title })
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
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

/// Idle seconds on Linux: tries xprintidle first (X11/XWayland), then falls
/// back to the GNOME Mutter D-Bus idle monitor (native Wayland). Both tools
/// ship with or can be installed on Ubuntu:
///   X11/XWayland: sudo apt install xprintidle
///   Wayland/GNOME: gdbus is part of glib2 (pre-installed on Ubuntu desktop)
#[cfg(target_os = "linux")]
fn system_idle_seconds() -> Result<u64, String> {
    // xprintidle outputs milliseconds as a plain integer
    if let Ok(out) = std::process::Command::new("xprintidle").output() {
        if out.status.success() {
            if let Ok(ms) = String::from_utf8_lossy(&out.stdout).trim().parse::<u64>() {
                return Ok(ms / 1000);
            }
        }
    }

    // GNOME Mutter idle monitor via D-Bus. Output: "(uint64 <ms>,)\n"
    let out = std::process::Command::new("gdbus")
        .args([
            "call",
            "--session",
            "--dest",
            "org.gnome.Mutter.IdleMonitor",
            "--object-path",
            "/org/gnome/Mutter/IdleMonitor/Core",
            "--method",
            "org.gnome.Mutter.IdleMonitor.GetIdletime",
        ])
        .output()
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        let raw = String::from_utf8_lossy(&out.stdout);
        // Strip parens, comma, and optional "uint64 " type prefix
        let inner = raw.trim().trim_start_matches('(').trim_end_matches(",)").trim();
        let ms_str = inner.split_whitespace().last().unwrap_or(inner);
        let ms: u64 = ms_str
            .parse()
            .map_err(|_| "failed to parse gdbus idle time".to_string())?;
        return Ok(ms / 1000);
    }

    Err("idle detection needs xprintidle (X11) or GNOME/Mutter (Wayland). Install: sudo apt install xprintidle".to_string())
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
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
