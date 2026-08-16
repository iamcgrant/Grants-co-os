# Brand System — Grants & Co OS

Visual reference: [grantandconsultants.com](https://grantandconsultants.com)  
Purpose: brand identity only — not layout, pricing, forms, or business logic.

## Extracted brand language

| Token | Value | Use in OS |
|-------|-------|-----------|
| Charcoal base | `#16161a` | App shell background |
| Near-black | `#0a0b0e` | Depth |
| Navy | `#202a44` / `#2e3e68` | Secondary structure, button text |
| Gold accent | `#f5b82a` | Eyebrows, CTAs, focus rings |
| Ice blue | `#b2d4ff` / `#6887d6` | Soft atmospheric glow (sparingly) |
| Muted | `#8a93a5` / `#929292` | Secondary labels |
| Display type | **Fraunces** | Headlines, amounts, brand wordmark |
| Body type | **Manrope** | UI, forms, navigation |
| Surfaces | Glass + hairline white borders | Panels, nav, inputs |
| Motion | Soft fade-up, restrained sheen | Hierarchy, not noise |

## OS interpretation (not a website clone)

Grants OS should feel like **luxury fintech + Apple simplicity**:

- App shell, not marketing page
- One job per screen
- Large Fraunces figures for money/scores
- Manrope for controls and density
- Dark charcoal atmosphere with gold punctuation
- No service cards, pricing blocks, testimonials, or marketing CTAs pulled from the website

## Implementation

CSS variables live in `src/app/globals.css`.  
Fonts loaded in `src/app/layout.tsx`.
