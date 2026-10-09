# Phases — Udemy Planly

Status key: ✅ done · 🔄 in progress · ⬜ planned

## Phase 1 — Foundation (v1.0–1.2) ✅
- MV3 skeleton: manifest, service worker, popup, dashboard, options.
- Scrape Udemy sidebar, store courses in `chrome.storage.local`.
- First AI-assisted planner and basic streak.
- Excel export/import.

## Phase 2 — Reliability fixes (v1.3.0–1.3.1) ✅
- Removed auto-click scraping; scraping is now read-only, Sync button is the only click.
- Fixed "only the last lecture per module" (position-based keys, per-module merge).
- Fixed completion detection and duration parsing.
- Replaced UTC with local dates.
- Removed `scripting` / `activeTab` permissions.
- New skeuomorphic UI: cardboard panels, rotary dial, flame streak, heatmaps.

## Phase 3 — Planning & tracking (v1.3.2–1.3.3) ✅
- Re-read ticks before building plans; periodic/event-driven re-scan.
- Plan progress ("2 of 4 watched"), manual watched ticks, session complete state.
- Hover tooltips on heatmap/week circles; minutes recorded per day.
- "Top up / Remove finished / Keep list" prompt.

## Phase 4 — Goals, days & theme (v1.3.4) ✅
- Daily goal setting; configurable day start (default 4 AM).
- Dark e-ink theme, remembered across pages.

## Phase 5 — Simplification (v1.3.5–1.3.6) ✅
- Removed AI planning, API key, model picker and `openrouter.ai` host permission; fully offline.
- Fixed 10-minute cost for quizzes/coding exercises.
- Dial defaults to the daily goal.
- Fixed real-markup scraper bug (sub-part selectors matching); added regression fixture.

## Phase 6 — Visual polish & streak rule (v1.3.7–1.3.8) ✅
- Higher-resolution flame, shared surface for streak/activity/dial cards, number inside the flame.
- Heatmap uses the app accent colour.
- Streak now counts **finishing the day's plan**, not minutes vs goal.

## Phase 7 — Documentation & project hygiene 🔄
- Add `docs/` (PRD, Architecture, Rules, Phases, Design, memory).
- Keep `memory.md` and README changelog updated per change.

## Phase 8 — Hardening ⬜
- Extract pure logic (planner, merge, streak) into testable modules + unit tests.
- Add a saved real-Udemy markup fixture set; scraper regression suite.
- More resilient item IDs (title + position) to survive instructor edits.
- Import validation and a "restore preview".

## Phase 9 — Feature extensions ⬜
- Multi-course "today" plan.
- Per-course daily goal and target finish date.
- Optional weekly summary in the dashboard.
- Keyboard shortcuts.

## Phase 10 — Release ⬜
- Store-ready icons (16/32/48/128) and screenshots.
- Licence check for flame art; replace if not clear.
- Privacy policy (no data collected) and Chrome Web Store listing.
- Version tagging and release notes.

## Dependencies
Phase 8 → 10 (tests before publishing). Phase 9 is independent and optional.
