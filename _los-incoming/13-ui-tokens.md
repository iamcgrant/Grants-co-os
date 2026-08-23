# UI tokens — Mortgage Readiness module

Reuse Grants & Co OS brand. Do not invent a second design system and do not redraw the logo.

## Existing OS tokens (docs/BRAND.md — FOUND)

- Charcoal / black: `#16161a`
- Gold (use as champagne gold): `#f5b82a`
- Ice (existing accent): `#b2d4ff`
- Wordmark component: `src/components/brand/BrandLogo.tsx` → `/brand/logo.png`
- Type: Fraunces (wordmark / display) + Manrope (UI)

## Module additions (cream paper)

- Cream paper: `#f6f1e7`
- White: `#ffffff`
- Hairline: `rgba(22,22,26,0.12)`
- Gold button text: `#16161a` on `#f5b82a`

```css
.mros {
  --mros-black: #16161a;
  --mros-gold: #f5b82a;
  --mros-cream: #f6f1e7;
  --mros-white: #ffffff;
  --mros-ice: #b2d4ff;
}
```

Logo: only `public/brand/logo.png` (and icon-mark.png where a mark is needed). Never generate, trace, or SVG-redraw the emblem.
Client apply chrome: cream paper, black type, gold primary CTA, thin gold rule under the wordmark. Staff desk: existing StaffShell + gold pipeline chips.
