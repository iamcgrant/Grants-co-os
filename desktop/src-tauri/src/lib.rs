//! Grants & Co OS desktop library entry.
//! Web application remains canonical; this wrapper provides native windowing + notifications.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .run(tauri::generate_context!())
    .expect("error while running Grants & Co OS desktop");
}
