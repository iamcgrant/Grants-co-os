//! Grants & Co OS desktop library entry.
//! Web application remains canonical; this wrapper provides native windowing + plugins.

use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

const DEFAULT_APP_URL: &str = "https://os.grantandconsultants.com";

fn resolve_app_url() -> String {
  std::env::var("GC_DESKTOP_URL").unwrap_or_else(|_| DEFAULT_APP_URL.to_string())
}

fn navigate_main_window(app: &tauri::AppHandle, target: &str) {
  if let Some(window) = app.get_webview_window("main") {
    let escaped = serde_json::to_string(target).unwrap_or_else(|_| format!("\"{}\"", target));
    let script = format!(
      "window.__gcNavigated = true; window.location.replace({escaped});"
    );
    let _ = window.eval(&script);
  }
}

fn handle_deep_link(app: &tauri::AppHandle, urls: Vec<tauri::Url>) {
  if urls.is_empty() {
    return;
  }

  let base = resolve_app_url().trim_end_matches('/').to_string();
  let first = urls[0].as_str().trim();

  let target = if first.starts_with("grantscoos://") {
    first.replacen("grantscoos://", &format!("{base}/"), 1)
  } else if first.starts_with("http://") || first.starts_with("https://") {
    first.to_string()
  } else {
    let path = first.trim_start_matches('/');
    format!("{base}/{path}")
  };

  navigate_main_window(app, &target);

  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[cfg(desktop)]
fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
  use tauri::menu::{Menu, MenuItem};
  use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

  let show = MenuItem::with_id(app, "show", "Show Grants & Co OS", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &quit])?;

  let Some(icon) = app.default_window_icon().cloned() else {
    return Ok(());
  };

  TrayIconBuilder::new()
    .icon(icon)
    .menu(&menu)
    .tooltip("Grants & Co OS")
    .on_menu_event(|app, event| match event.id.as_ref() {
      "show" => {
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window("main") {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    })
    .build(app)?;

  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_deep_link::init());

  #[cfg(desktop)]
  {
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
      }
    }));
  }

  builder
    .setup(|app| {
      #[cfg(any(windows, target_os = "linux"))]
      {
        app.deep_link().register_all()?;
      }

      let handle = app.handle().clone();
      app.deep_link().on_open_url(move |event| {
        handle_deep_link(&handle, event.urls());
      });

      if let Ok(Some(urls)) = app.deep_link().get_current() {
        handle_deep_link(app.handle(), urls);
      }

      #[cfg(desktop)]
      setup_tray(app.handle())?;

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Grants & Co OS desktop");
}
