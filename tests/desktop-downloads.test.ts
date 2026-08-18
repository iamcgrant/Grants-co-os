import { describe, expect, it } from "vitest";
import { pickDesktopAssetsFromRelease } from "../src/lib/desktop/downloads";

describe("desktop download asset picker", () => {
  it("maps mac/win/linux release assets", () => {
    const picked = pickDesktopAssetsFromRelease([
      {
        name: "Grants & Co OS_0.1.0_aarch64.dmg",
        browser_download_url: "https://example.com/mac.dmg",
      },
      {
        name: "Grants & Co OS_0.1.0_x64-setup.exe",
        browser_download_url: "https://example.com/win.exe",
      },
      {
        name: "Grants & Co OS_0.1.0_amd64.AppImage",
        browser_download_url: "https://example.com/linux.AppImage",
      },
    ]);
    expect(picked.macUrl).toContain("mac.dmg");
    expect(picked.winUrl).toContain("win.exe");
    expect(picked.linuxUrl).toContain("linux.AppImage");
  });
});
