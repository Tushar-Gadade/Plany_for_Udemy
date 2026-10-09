# Memory — Udemy Planly

> Living log. Read this first; update it last, after every work session.
> Last updated: 2026-10-09

## Current status
- **Version:** 1.3.8 (see `manifest.json`)
- **State:** Feature-complete for personal use; no known open bugs recorded.
- **Currently being worked on:** *Nothing in progress.* Phase 7 (documentation) — `docs/` folder was just created.
- **Files currently being edited:** none (docs only: `docs/*.md`).

## Completed
### Core
- [x] MV3 extension skeleton (`manifest.json`, `background.js`, popup, dashboard, options)
- [x] Read-only Udemy sidebar scraper (`content-udemy.js`) with manual **Sync all modules**
- [x] Position-based item IDs and per-module merge (no more "last lecture only")
- [x] Correct completion + duration detection (verified against real row markup)
- [x] Local-date handling with configurable day start (default 4 AM)

### Planning
- [x] Fixed-rule planner: course order, never over budget, never splits, overflow flag
- [x] Quiz/coding exercise cost fixed at 10 min; untimed lecture 10 min
- [x] Dial/typed time input (`90`, `90m`, `1.5h`, `1h 30m`, `1:30`), defaults to daily goal
- [x] Plan progress, manual watched ticks, Top up / Remove finished / Keep list
- [x] AI planning **removed** (1.3.5); no network access at all

### Streak & activity
- [x] Streak counts a day when the whole "Plan my session" is finished (1.3.8)
- [x] `planMet` days are permanent once earned
- [x] Month heatmaps with hover time/lecture details; week circles
- [x] Blue-flame streak card (always animating)

### UI / theme
- [x] Light e-ink + dark e-ink themes, remembered across pages
- [x] Cardboard panels, rotary dial, embossed labels, bundled fonts
- [x] Popup, full dashboard (curriculum tree, stats ring), options page

### Data
- [x] Excel export/import (SheetJS, bundled)
- [x] Permissions reduced to `storage` + `https://www.udemy.com/*`

### Docs
- [x] README with full changelog and known limits
- [x] `docs/PRD.md`, `Architecture.md`, `Rules.md`, `Phases.md`, `Design.md`, `memory.md`

## Key decisions (don't undo without asking)
1. No AI, no network — planner is a deterministic rule.
2. Scraping never clicks, except the user-pressed Sync (module headers only, never in the player).
3. Streak = finished that day's plan. Daily goal only shades heatmap / "today" stat.
4. Exercises/quizzes are always 10 minutes (not a setting).
5. All storage writes go through `background.js`.
6. Plain JS/CSS, no build step.

## Known limits / risks
- Scraper validated on a fixture + one real row of markup, not the live site; Udemy DOM changes can break it (add selectors at top of `CANDIDATE_SELECTORS`).
- Sync needs the sidebar visible (not theatre/narrow mode).
- Position-based IDs can shift manual ticks if the instructor inserts lectures.
- Streak reset expected the first time 1.3.8 is opened (old days lack `planMet`).
- Flame art and fonts: confirm licences before any public release.

## Next up (from `Phases.md`)
1. Phase 8: extract pure logic + unit tests, saved real-markup fixtures.
2. Phase 8: sturdier item IDs, import validation.
3. Phase 10: store icons, licence check, privacy policy.

## Session log
| Date | What | Files |
|---|---|---|
| 2026-10-09 | Created project docs folder from codebase review | `docs/PRD.md`, `docs/Architecture.md`, `docs/Rules.md`, `docs/Phases.md`, `docs/Design.md`, `docs/memory.md` |

## How to update this file
- Tick items under **Completed** as work finishes; add new ones.
- Set **Currently being worked on** and **Files currently being edited** when starting, clear them when done.
- Add one row to **Session log** per session.
