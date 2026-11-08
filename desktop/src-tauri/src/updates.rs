//! In-app updates from the public GitHub release.
//! The website stays the source of truth. This only replaces the desktop shell.
//! Version 0.1.5 and older do not contain this check, so they cannot update themselves.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;

use serde::Deserialize;
use tauri::async_runtime::spawn;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tauri_plugin_notification::NotificationExt;

const RELEASES_URL: &str = "https://api.github.com/repos/iamcgrant/Grants-co-os/releases/latest";
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);

#[derive(Debug, Deserialize)]
struct Release {
    tag_name: String,
    assets: Vec<Asset>,
}

#[derive(Debug, Deserialize)]
struct Asset {
    name: String,
    browser_download_url: String,
}

pub fn start(app: &AppHandle) {
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(8));
        loop {
            let app = handle.clone();
            spawn(async move {
                let _ = offer_update(app, false).await;
            });
            std::thread::sleep(CHECK_EVERY);
        }
    });
}

pub fn check_now(app: AppHandle) {
    spawn(async move {
        let _ = offer_update(app, true).await;
    });
}

async fn offer_update(app: AppHandle, interactive: bool) -> Result<(), String> {
    let current = app.package_info().version.to_string();
    let release = match fetch_latest().await {
        Ok(release) => release,
        Err(error) => {
            if interactive {
                tell(
                    &app,
                    "Updates",
                    format!("Could not check for an update. {error}"),
                );
            }
            return Err(error);
        }
    };

    let latest = release
        .tag_name
        .trim_start_matches("desktop-v")
        .trim_start_matches('v')
        .to_string();
    if !is_newer(&latest, &current) {
        if interactive {
            tell(&app, "Updates", "Grants & Co OS is up to date.".to_string());
        }
        return Ok(());
    }

    let Some(asset) = pick_asset(&release.assets) else {
        if interactive {
            tell(
                &app,
                "Updates",
                format!("Version {latest} is published, but there is no installer for this Mac."),
            );
        }
        return Ok(());
    };

    let body = format!("Version {latest} is ready. You can install it now.");
    let _ = app
        .notification()
        .builder()
        .title("Grants & Co OS update")
        .body(&body)
        .show();

    let download_url = asset.browser_download_url.clone();
    let file_name = asset.name.clone();
    let app_for_install = app.clone();
    app.dialog()
        .message(body)
        .title("Update Grants & Co OS")
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Update".to_string(),
            "Later".to_string(),
        ))
        .show(move |install_now| {
            if !install_now {
                return;
            }
            let app = app_for_install.clone();
            spawn(async move {
                match download_and_stage(&download_url, &file_name).await {
                    Ok(()) => {}
                    Err(error) => tell(
                        &app,
                        "Update Grants & Co OS",
                        format!("The update did not install. {error}"),
                    ),
                }
            });
        });
    Ok(())
}

fn tell(app: &AppHandle, title: &str, message: String) {
    let _ = app.dialog().message(message).title(title).show(|_| {});
}

async fn fetch_latest() -> Result<Release, String> {
    let output = Command::new("curl")
        .args([
            "-fsSL",
            "-A",
            "GrantsCoOS",
            "-H",
            "Accept: application/vnd.github+json",
            RELEASES_URL,
        ])
        .output()
        .map_err(|error| format!("curl is not available ({error})"))?;
    if !output.status.success() {
        return Err(format!(
            "GitHub returned an error ({})",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    serde_json::from_slice(&output.stdout).map_err(|error| format!("Could not read the release ({error})"))
}

async fn download_and_stage(url: &str, file_name: &str) -> Result<(), String> {
    let dir = std::env::temp_dir().join(format!("grants-co-os-update-{}", std::process::id()));
    std::fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    let disk = dir.join(file_name);
    let status = Command::new("curl")
        .args(["-fL", "-A", "GrantsCoOS", "-o"])
        .arg(&disk)
        .arg(url)
        .status()
        .map_err(|error| error.to_string())?;
    if !status.success() {
        return Err("The download did not finish.".to_string());
    }
    install_macos(&disk)
}

#[cfg(target_os = "macos")]
fn install_macos(disk_image: &Path) -> Result<(), String> {
    let mount = disk_image.with_extension("mount");
    std::fs::create_dir_all(&mount).map_err(|error| error.to_string())?;
    let attached = Command::new("hdiutil")
        .args(["attach", "-nobrowse", "-mountpoint"])
        .arg(&mount)
        .arg(disk_image)
        .status()
        .map_err(|error| error.to_string())?;
    if !attached.success() {
        return Err("The installer disk could not be opened.".to_string());
    }

    let app = find_app(&mount).ok_or_else(|| "The installer did not contain the app.".to_string())?;
    let script = mount.join("install-update.sh");
    std::fs::write(
        &script,
        r#"#!/bin/bash
set -euo pipefail
pid="$1"
src="$2"
dest="/Applications/Grants & Co OS.app"
while kill -0 "$pid" 2>/dev/null; do
  sleep 0.3
done
rm -rf "$dest"
ditto "$src" "$dest"
xattr -cr "$dest" || true
codesign --force --deep --sign - "$dest" || true
open "$dest"
"#,
    )
    .map_err(|error| error.to_string())?;

    Command::new("bash")
        .arg(&script)
        .arg(std::process::id().to_string())
        .arg(&app)
        .spawn()
        .map_err(|error| error.to_string())?;

    // The script replaces this copy after the process exits.
    std::process::exit(0);
}

#[cfg(not(target_os = "macos"))]
fn install_macos(disk_image: &Path) -> Result<(), String> {
    let _ = disk_image;
    Err("Open the downloaded installer to finish the update.".to_string())
}

fn find_app(root: &Path) -> Option<PathBuf> {
    let entries = std::fs::read_dir(root).ok()?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) == Some("app") {
            return Some(path);
        }
    }
    None
}

fn pick_asset(assets: &[Asset]) -> Option<&Asset> {
    assets.iter().find(|asset| is_installer_for_this_mac(&asset.name))
}

fn is_installer_for_this_mac(name: &str) -> bool {
    let name = name.to_lowercase();
    if !name.ends_with(".dmg") {
        return false;
    }
    if cfg!(target_arch = "aarch64") {
        name.contains("aarch64")
    } else {
        name.contains("x64") && !name.contains("aarch64")
    }
}

fn is_newer(latest: &str, current: &str) -> bool {
    fn parts(value: &str) -> Vec<u64> {
        value
            .split('.')
            .map(|part| part.parse::<u64>().unwrap_or(0))
            .collect()
    }
    parts(latest) > parts(current)
}

#[cfg(test)]
mod tests {
    use super::{is_newer, Asset, pick_asset};

    #[test]
    fn a_later_release_is_newer() {
        assert!(is_newer("0.1.6", "0.1.5"));
        assert!(!is_newer("0.1.5", "0.1.5"));
        assert!(!is_newer("0.1.4", "0.1.5"));
    }

    #[test]
    fn picks_the_apple_silicon_disk_image() {
        let assets = [
            Asset {
                name: "Grants.Co.OS_0.1.6_x64.dmg".into(),
                browser_download_url: "https://example.com/intel".into(),
            },
            Asset {
                name: "Grants.Co.OS_0.1.6_aarch64.dmg".into(),
                browser_download_url: "https://example.com/arm".into(),
            },
        ];
        let picked = pick_asset(&assets).map(|asset| asset.name.as_str());
        if cfg!(target_arch = "aarch64") {
            assert_eq!(picked, Some("Grants.Co.OS_0.1.6_aarch64.dmg"));
        } else if cfg!(target_arch = "x86_64") {
            assert_eq!(picked, Some("Grants.Co.OS_0.1.6_x64.dmg"));
        }
    }
}
