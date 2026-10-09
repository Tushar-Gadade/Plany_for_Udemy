# Design — Udemy Planly

**Style name:** "Skeuomorphic Modern" — matte e-ink paper, cardboard hardware, embossed lettering, a blue-flame streak.
All tokens live in `shared/theme.css` (and `shared/streak.css` for the flame/heatmap).

## 1. Colour

### Light theme
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#e8e6df` | Page background |
| `--paper-hi` | `#efede7` | Panels, raised surfaces |
| `--paper-2` | `#e3e1d9` | Secondary surfaces |
| `--paper-deep` | `#d3d0c6` | Tracks, toggles off, progress bg |
| `--line` / `--line-soft` | `#c6c3b8` / `#d9d6cc` | Borders, dashed dividers |
| `--ink` | `#292524` | Primary text (stone-800) |
| `--ink-soft` | `#57534e` | Secondary text |
| `--ink-faint` | `#6f6963` | Hints, captions |
| `--accent` | `#0e7490` | Links, progress, active states (deep cyan) |
| `--accent-2` | `#22d3ee` | Gradient end, glows, heatmap peak |
| `--accent-soft` | `rgba(14,116,144,.12)` | Tinted backgrounds |
| `--success` | `#3f6b4a` | Completed, goal met |
| `--board` / `--board-deep` | `#dcdad2` / `#cbc9bf` | Cardboard panels (dial, streak, activity, sidebar) |
| `--board-ink` | `#67645a` | Embossed labels |
| `--ember` | `#ff6a1a` | Dial LED and lit dots |
| Warning pill | `#9a4b0a` on `rgba(180,90,20,.12)` | Overflow / warnings |
| Error text | `#a03a12` | Plan errors |

### Dark theme (`html[data-theme="dark"]`)
| Token | Hex |
|---|---|
| `--paper` | `#1c1c1a` |
| `--paper-hi` | `#252523` |
| `--paper-2` | `#2a2a27` |
| `--paper-deep` | `#3a3a36` |
| `--line` / `--line-soft` | `#3d3d39` / `#33332f` |
| `--ink` / `--ink-soft` / `--ink-faint` | `#e7e5de` / `#bcb9af` / `#96938a` |
| `--accent` | `#5cc8e0` |
| `--success` | `#8cc79b` |
| `--board` / `--board-deep` / `--board-ink` | `#2b2b28` / `#353531` / `#a5a298` |
| Tooltip | bg `#efede7`, ink `#1c1c1a` |

### Special colours
- Streak number: `#ffe9b8` with warm amber glow (`#7a3c00`, `rgba(255,140,30,.85)`), sits in the flame's core.
- Primary button (light): dark gradient `#5a5550 → #292524`, text `#f6efd0`. In dark theme it inverts to light gradient `#f1efe9 → #cdcbc1`.
- Progress ring / toggle on: gradient `#0e7490 → #22d3ee`.
- Heatmap cells: accent colour scaling pale → bright with minutes (levels at <15 / 45 / 90 / more).

## 2. Theme feel
- **Matte e-ink page:** a very fine powder grain (SVG `feTurbulence`, ~16% opacity light / 9% dark), no vignette, no gloss, no burnt edges.
- **Cardboard panels:** flat `--board` tone with the same fine grain, 1px border, subtle inner top highlight.
- **Keys (buttons):** raised gradient with a hard 2–3px bottom edge; pressing translates down 2–3px and flattens the shadow.
- **Inputs:** inset shadow, as if pressed into the board; focus ring is accent + 3px soft halo.
- **Embossed labels:** `text-shadow: 0 1px 0 rgba(255,255,255,.75)` (light) / `0 -1px 0 rgba(0,0,0,.55)` (dark).
- **Dial:** gear-toothed collar, red-orange LED, dotted meter that lights as you turn.
- **Flame:** 8-frame sprite loop (`assets/flame-loop.png`), always animating, never freezes or goes dark.
- **Motion:** short, physical (80–200 ms ease); ring fill 0.7 s; flame 0.96 s loop. Respect reduced-motion where added.

## 3. Fonts
Bundled locally (SIL OFL); no network fonts.

| Role | Family | Weights | Fallback |
|---|---|---|---|
| UI / body / headings | **EB Garamond** | 400, 500, 600, 700 | Georgia, 'Times New Roman', serif |
| Numbers, readouts, pills, time | **Courier Prime** | 400, 700 | 'Courier New', ui-monospace, monospace |

## 4. Typography scale
| Element | Font | Size / weight |
|---|---|---|
| Base body | EB Garamond | 15px / 400, line-height 1.38 |
| Brand wordmark | EB Garamond | 24px / 600 |
| Panel title | EB Garamond | 19px / 600 |
| Buttons | EB Garamond | 15px / 600 |
| Inputs | EB Garamond (mono variant: Courier Prime) | 15px / 500 (mono 16px / 700) |
| Adjust prompt question | EB Garamond | 14.5px / 600 |
| Small notes / scan notes | EB Garamond | 13px |
| Task sub-text | EB Garamond | 12.5px, `--ink-faint` |
| Time readout (dial) | Courier Prime | 30px / 700, letter-spacing −0.02em |
| Streak number | Courier Prime | 46px / 700 |
| Plan summary | Courier Prime | 15px / 700 |
| Pills | Courier Prime | 12px / 700 |
| Heatmap tooltip | Courier Prime | 12px / 400, highlighted time `#d97b1e` |

Headings use `letter-spacing: 0.005em`; embossed labels use weight 600.

## 5. Shape & spacing
- Radii: panel 14px · button 10px · tile 12px · input 9px · pill 999px · toggle full round.
- Toggle: 44 × 25px. Icon buttons: 34 × 34px.
- Popup is compact (single column, top grid of streak + activity); dashboard uses sidebar + main with panels.
- Dividers are dashed `--line` between list rows.

## 6. Components checklist
Panel · Cardboard panel · Key button (default / primary / ghost / icon) · Field · Toggle · Pill (accent / success / warn) · Progress bar · Progress ring · Rotary knob · Streak card with flame · Week dots · Month heatmap tile + tooltip · Task row (strike-through when done) · Adjust prompt · Curriculum tree (expand/collapse) · Scan note (info / warn) · Empty state.

## 7. Accessibility
- Visible `:focus-visible` outline (2px accent) on all controls.
- Icon-only buttons carry `aria-label` and `title`.
- Colour is never the only signal: completion also uses strike-through/check, overflow uses a labelled pill.
- Contrast: ink on paper and accent on board meet AA for body text in both themes; recheck any new colour pairing.
