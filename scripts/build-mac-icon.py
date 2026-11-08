"""White rounded Mac app icon using the Grant & Co Consultants mark in blue."""
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "_los-incoming" / "grant-and-co-logo-from-cognito.png"
OUT_DIR = ROOT / "desktop" / "src-tauri" / "icons"
BRAND = ROOT / "public" / "brand" / "app-icon.png"
WEB_ICONS = ROOT / "public" / "icons"
FAVICON = ROOT / "src" / "app" / "favicon.ico"

NAVY = (14, 58, 112)
SIZE = 1024


def squircle(size: int, n: float = 5.0) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    pixels = mask.load()
    center = (size - 1) / 2.0
    radius = center
    for y in range(size):
        dy = abs(y - center) / radius
        dy_n = dy ** n
        for x in range(size):
            dx = abs(x - center) / radius
            if dx ** n + dy_n <= 1:
                pixels[x, y] = 255
    return mask


def keyed_emblem() -> Image.Image:
    src = Image.open(SOURCE).convert("RGBA")
    emblem = src.crop((138, 264, 344, 470))
    pixels = emblem.load()
    width, height = emblem.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            lum = max(red, green, blue)
            if lum < 22:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            gray = abs(red - green) < 18 and abs(green - blue) < 22 and red < 90
            if gray:
                fade = 1.0 if lum >= 40 else (lum - 22) / 18
                pixels[x, y] = (*NAVY, int(min(255, alpha * fade)))
            elif lum < 40:
                fade = (lum - 22) / 18
                pixels[x, y] = (red, green, blue, int(alpha * fade))
    return emblem


def build() -> Image.Image:
    canvas = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    white = Image.new("RGBA", (SIZE, SIZE), (255, 255, 255, 255))
    canvas.paste(white, (0, 0), squircle(SIZE))
    target = 800
    emblem = keyed_emblem().resize((target, target), Image.Resampling.LANCZOS)
    emblem = emblem.filter(ImageFilter.UnsharpMask(radius=1.4, percent=90, threshold=2))
    origin = ((SIZE - target) // 2, (SIZE - target) // 2 - 8)
    canvas.paste(emblem, origin, emblem)
    return canvas


def main() -> None:
    icon = build()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    WEB_ICONS.mkdir(parents=True, exist_ok=True)
    icon.save(BRAND)
    icon.save(OUT_DIR / "icon.png")
    for size, name in (
        (32, "32x32.png"),
        (64, "64x64.png"),
        (128, "128x128.png"),
        (256, "128x128@2x.png"),
    ):
        icon.resize((size, size), Image.Resampling.LANCZOS).save(OUT_DIR / name)
    icon.resize((192, 192), Image.Resampling.LANCZOS).save(WEB_ICONS / "icon-192.png")
    icon.resize((512, 512), Image.Resampling.LANCZOS).save(WEB_ICONS / "icon-512.png")
    icon.resize((256, 256), Image.Resampling.LANCZOS).save(FAVICON)
    corner = icon.getpixel((4, 4))
    if corner[3] != 0:
        raise SystemExit(f"Icon corners are not transparent: {corner}")
    print(f"Wrote white rounded Mac icon → {BRAND}")


if __name__ == "__main__":
    main()
