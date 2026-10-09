# Rules — Udemy Planly

Guidelines for anyone (human or AI assistant) changing this codebase.

## 1. What to use
- **Vanilla JS, HTML, CSS.** No framework, no bundler, no build step.
- **Chrome MV3 APIs only:** `chrome.storage.local`, `chrome.runtime` messaging, `chrome.tabs.query/sendMessage`.
- **Bundled libraries only:** SheetJS (`lib/`), Heroicons (inlined), EB Garamond + Courier Prime (`assets/fonts`).
- **Design tokens** from `shared/theme.css` (`var(--ink)`, `var(--accent)`, `var(--board)`, ...). Never hard-code a colour that already has a token.
- **Shared helpers** in `shared/util.js` (`sendMsg`, `parseTimeInput`, `formatMinutes`, `escapeHtml`, `mountToggle`, ...) before writing new ones.
- **Local dates** via the logical-day helpers (day starts at `dayStartHour`, default 4 AM).
- **Small, additive changes** and a README changelog entry + `manifest.json` version bump for every user-visible change.

## 2. What to avoid
- **No AI/LLM features, API keys, or any network request.** Planning is a fixed rule (removed in 1.3.5; do not reintroduce).
- **No new permissions** (`scripting`, `activeTab`, `tabs`, extra host patterns) without explicit approval.
- **No UTC dates** for "today" or streaks.
- **No inline `<script>` or inline event handlers** (MV3 CSP). Use external files.
- **No `localStorage` for app data** — only the theme flag. App data goes in `chrome.storage.local` via the background worker.
- **No `innerHTML` with scraped or user text** unless passed through `escapeHtml`.
- **No external CDNs, fonts, images or scripts.**
- **No remote code / `eval` / `new Function`.**
- **No frameworks "just for one animation"** — use CSS.
- **Don't change the streak rule** (plan completion, not minutes vs goal) or the exercise cost (fixed 10 min) without a product decision.

## 3. Hard safety rule: never touch the Udemy player
- Scraping is **read-only**.
- The only click ever sent to Udemy is inside `syncAllSections()`, only after the user presses **Sync**, only on collapsed *module headers*, and never on anything matching `PLAYER_SELECTOR`.
- No synthetic key events, no `aria-expanded` mass-clicking, no MutationObserver-driven clicks.
- DOM mutations inside the player must not trigger scrapes.

## 4. Data rules
- **Only `background.js` writes** to `chrome.storage.local`. UI and content script send messages.
- **Merge per module**; a partial scrape must never shrink a course.
- **Never delete user data silently.** Schema changes bump `SCHEMA` and migrate or rebuild with a README note.
- Keep stored shapes backward compatible (spread defaults in `getAll()`).
- Once `streak.planMet[date]` is true it is never unset.

## 5. Error handling
- Every message handler returns `{ ok: true, ... }` or `{ ok: false, error: string }`; the router wraps handlers in try/catch.
- UI shows errors in the existing status area (`.gen-status.err`, `.scan-note.warn`) — plain language, with the fix ("open the course player and press Sync").
- Calls to the Udemy tab may fail (`no-tab`, `no-listener`): treat as non-fatal and fall back to stored data.
- Validate all numbers (`Number.isFinite`, clamp ranges) before using or saving them.
- Excel import: validate sheet names and columns; fail with a message, never half-restore.
- Scraper: if no selector matches, report zero items with a note instead of throwing; log with a `[Planly]` prefix only.

## 6. Code style
- 2-space indent, single quotes, semicolons, `const`/`let`, `async/await`.
- Header comment on each file explaining its role; comment the *why* for non-obvious rules.
- Pure helpers where possible (planner, merge, streak maths) so they can be tested without Chrome.
- Accessibility: buttons have `aria-label`, focus-visible outlines are kept, dial supports arrow keys / PageUp / PageDown.

## 7. Boundaries for AI assistants
**May do**
- Edit files inside `udemy-planly/`, add docs, fix bugs, refactor within the rules above.
- Add tests/fixtures for the scraper and planner.
- Update `README.md`, `docs/memory.md`, and the version number when finishing work.

**Must ask first**
- Adding permissions, libraries, build tooling, or any network access.
- Changing streak, planning cost, or day-boundary rules.
- Changing the storage schema or the message contract.
- Replacing the visual theme or bundled assets/fonts.

**Must never**
- Add AI features or telemetry.
- Click or dispatch events on Udemy's player or invent selectors claimed to be "verified" against the live site.
- Claim something was tested on live Udemy if it was only tested on fixtures.
- Overwrite user backups or data files, or rewrite unrelated files in a change.

**Working habits**
- Read `docs/memory.md` first; update it last.
- Work one phase / one small task at a time (see `Phases.md`).
- State assumptions; don't guess Udemy's DOM — ask the user for a sample of the real markup.

## 8. Testing checklist (before finishing a change)
1. Reload the extension and refresh every open Udemy tab.
2. Sync a real course: all modules and every lecture appear, completion matches Udemy.
3. Plan with 30m, `1h 30m`, and a time shorter than the next item (overflow flag).
4. Finish items; verify progress, Top up / Remove / Keep, and streak on completing the plan.
5. Toggle dark/light on popup, dashboard, options.
6. Export then import the `.xlsx`; state matches.
7. Confirm the player never plays, pauses or toggles fullscreen by itself.
