---
name: premium-details
description: Premium micro-polish for shipped UI (~10%): press states, hover gating, focus, typography rhythm, tabular numerals, staged entrance, reduced-motion fallbacks. Use when a site works and needs an expert hand without redesign.
---

# Premium Details (~10% polish, no redesign)

Distilled from jakubkrehel/skills (better-ui, better-typography, better-accessibility):
- https://github.com/jakubkrehel/skills (~7.7k stars)
- Raw: better-ui, better-typography, better-accessibility SKILL.md
- Cross-checked with vercel web-design-guidelines and pbakaus/impeccable for severity.

## Rules (exact values)

1. Press: `:not(:disabled):active { transform: scale(0.96) }` over `150ms ease-out`. Never on disabled.
2. Never `transition: all`. Name properties: `transition-property: background-color, transform, box-shadow, opacity`.
3. Hover only for fine pointers: wrap `:hover` in `@media (hover: hover)`. Add `-webkit-tap-highlight-color: transparent` on buttons.
4. Keep `:focus-visible` ring. Add `scroll-padding-top` for sticky header; anchored targets get `scroll-margin-top`.
5. Type rhythm: headings `text-wrap: balance`, paragraphs/hints `text-wrap: pretty`. Changing numbers get `font-variant-numeric: tabular-nums`.
6. Inputs stay `>=16px` so iOS never zooms. Root gets font smoothing; `::selection` stays legible.
7. One staged entrance only: dashboard cards `opacity + translateY(12px)`, `300ms ease-out`, `100ms` stagger. Exits/infrequent only. High-frequency hovers instant or `<=150ms`.
8. Reduced motion: gate scale/translate/blur behind `prefers-reduced-motion: no-preference`; fallback is opacity cross-fade. Scrollable panels get `overscroll-behavior: contain`.

## Scope guard

- No layout redesign, no color change, no new components, no behavior change.
- CSS-only unless an ARIA/scroll-margin attribute is strictly required.
- Verify: syntax valid, all IDs intact, no `transition: all`, reduced-motion covered.
