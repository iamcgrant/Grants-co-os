//! Grants & Co OS desktop library entry.
//! Web application remains canonical; this wrapper provides native windowing + plugins.

mod updates;

use tauri::Manager;
use tauri_plugin_deep_link::DeepLinkExt;

const DEFAULT_APP_URL: &str = "https://os.grantandconsultants.com";

fn resolve_app_url() -> String {
  std::env::var("GC_DESKTOP_URL").unwrap_or_else(|_| DEFAULT_APP_URL.to_string())
}

fn navigate_main_window(app: &tauri::AppHandle, target: &str) {
  let Ok(url) = target.parse::<tauri::Url>() else {
    return;
  };
  if let Some(window) = app.get_webview_window("main") {
    // Native navigation. The packaged shell's JavaScript location change is ignored
    // by the macOS webview, which left "Continue manually" doing nothing.
    let _ = window.navigate(url);
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
  let update = MenuItem::with_id(app, "update", "Check for Updates", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &update, &quit])?;

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
      "update" => updates::check_now(app.clone()),
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

      // A normal launch already loads the site from tauri.conf.json.
      // Calling navigate() again during setup aborts that load on macOS and
      // leaves the window on about:blank (a white screen) the next time the app opens.
      // Deep links are the only startup navigation.
      if let Ok(Some(urls)) = app.deep_link().get_current() {
        let links: Vec<tauri::Url> = urls
          .into_iter()
          .filter(|url| {
            let value = url.as_str();
            value.starts_with("grantscoos://")
          })
          .collect();
        if !links.is_empty() {
          handle_deep_link(app.handle(), links);
        }
      }

      #[cfg(desktop)]
      {
        setup_tray(app.handle())?;
        updates::start(app.handle());
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running Grants & Co OS desktop");
}
