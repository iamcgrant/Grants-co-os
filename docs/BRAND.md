# Brand System — Grants & Co OS

Visual source of truth: [grantandconsultants.com](https://grantandconsultants.com)

The OS is the private members / operations side of the same brand — not a separate black-and-gold fintech template.

## Extracted from the live website

| Token | Value | Use |
|-------|-------|-----|
| Charcoal base | `#16161a` | Shell background |
| Near-black | `#040404` | Depth / overlays |
| Navy | `#202a44` | Primary button text |
| Ice blue | `#b2d4ff` | Eyebrows, status, accents, charts |
| Gold | `#f5b82a` | Sparse punctuation (stars, rare CTAs) |
| Muted | `#929292` / `#94a1b2` | Secondary labels |
| Display | **Fraunces** | Headlines, money, scores |
| Body | **Manrope** | UI, nav, forms |
| Primary CTA | White pill + circle-arrow DNA | `.gc-btn-primary` |
| Secondary CTA | Ghost / outline white | `.gc-btn-outline` |
| Logo | `/public/brand/logo.png` | Official site wordmark |

## OS interpretation

- Website DNA + software density
- Progressive disclosure (counts → lists → Client 360)
- Ice for structure; gold sparingly
- Development banner when not production
- Never invent a generic luxury identity that conflicts with the site

## Implementation

- Tokens: `src/app/globals.css`
- Logo: `src/components/brand/BrandLogo.tsx`
- Shell: `src/components/layout/StaffShell.tsx`
- Role nav: `src/lib/nav/role-nav.ts`
