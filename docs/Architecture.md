# Architecture — Udemy Planly

## 1. Tech stack
| Layer | Choice |
|---|---|
| Platform | Chrome Extension, **Manifest V3** |
| Language | Vanilla JavaScript (no framework, no bundler, no build step) |
| Background | ES-module **service worker** (`background.js`) |
| Page access | Content script on `https://www.udemy.com/course/*/learn/*` |
| UI | Static HTML + CSS, DOM built with plain JS |
| Storage | `chrome.storage.local` |
| Spreadsheet backup | SheetJS (`lib/xlsx.full.min.js`, Apache-2.0), bundled |
| Icons | Heroicons (MIT), inlined in `shared/icons.js` |
| Fonts | EB Garamond + Courier Prime (SIL OFL), bundled woff2 |
| Permissions | `storage`; host `https://www.udemy.com/*` only |
| Network | None |

## 2. High-level flow

```
 Udemy course player tab                Extension
┌────────────────────────┐   CURRICULUM_SCRAPED   ┌──────────────────────────┐
│ content-udemy.js       │ ─────────────────────▶ │ background.js (worker)   │
│  read-only DOM scrape  │                        │  merge → storage         │
│  Sync button = only    │ ◀───────────────────── │  plan / streak / backup  │
│  click path            │  PLANLY_SYNC_ALL /     │  owns ALL state writes   │
└────────────────────────┘  PLANLY_SCRAPE_NOW     └───────────┬──────────────┘
                                                              │ GET_STATE, GENERATE_PLAN,
                                                              │ ADJUST_PLAN, TOGGLE_MANUAL,
                                                              │ SAVE_SETTINGS, RESTORE_STATE
                                       ┌──────────────────────┴───────────────┐
                                       │ popup/  ·  dashboard/  ·  options/   │
                                       │ (shared/ utils, theme, knob, streak) │
                                       └──────────────────────────────────────┘
```

### Typical session
1. User opens a course in the Udemy player → content script scrapes the sidebar and sends `CURRICULUM_SCRAPED`.
2. Background merges per module, records newly completed lectures as activity, re-checks plan completion.
3. User opens popup/dashboard → UI first asks the Udemy tab to re-scan (`PLANLY_SCRAPE_NOW`), then `GET_STATE`.
4. User sets time (dial/typed) → `GENERATE_PLAN` → fixed order-preserving rule builds today's plan.
5. As lectures finish (Udemy tick or manual `TOGGLE_MANUAL`), progress updates; when every plan item is done, `syncPlanCompletion()` marks the day in `streak.planMet`.

## 3. Folder & file structure

```
udemy-planly/
├── manifest.json            MV3 manifest (v1.3.8)
├── background.js            Service worker: state, merge, planner, streak, message router
├── content-udemy.js         Udemy sidebar scraper (read-only; Sync is the only click)
├── README.md                Changelog + known limits
├── docs/                    Project documentation (this folder)
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   ├── Phases.md
│   ├── Design.md
│   └── memory.md
├── popup/
│   ├── popup.html           Compact view
│   ├── popup.css
│   └── popup.js
├── dashboard/
│   ├── dashboard.html       Full view: sidebar, curriculum tree, plan, stats
│   ├── dashboard.css
│   └── dashboard.js         Also builds/reads the .xlsx backup
├── options/
│   ├── options.html         Settings page
│   └── options.js
├── shared/
│   ├── util.js              sendMsg, date/streak helpers, time parse/format, toggles, theme
│   ├── theme.css            Design tokens, panels, buttons, inputs, dark theme
│   ├── theme-init.js        Sets data-theme before first paint (no inline scripts in MV3)
│   ├── streak.css           Flame card, week dots, heatmap tiles, tooltip
│   ├── streak.js            Renders flame, day dots, month tiles
│   ├── knob.js              Rotary study-time dial
│   ├── sound.js             Chime (Web Audio)
│   └── icons.js             Inline SVG icon set
├── lib/
│   ├── xlsx.full.min.js     SheetJS
│   └── XLSX_LICENSE.txt
└── assets/
    ├── flame-loop.png       Flame sprite sheet (8 frames)
    └── fonts/               EB Garamond, Courier Prime + OFL texts
```

## 4. Data model (`chrome.storage.local`)

```js
courses: { [courseId]: {
  schema: 2, title, url, scrapedAt,
  curriculum: [{ id, order, sectionIndex, sectionTitle, title,
                 kind: 'lecture'|'quiz', durationMin, completed }]
}}

plans: { [courseId]: {
  manualCompleted: { [itemId]: true },
  manualDates:     { [itemId]: 'YYYY-MM-DD' },
  days: { 'YYYY-MM-DD': { minutes, taskIds[], plannedMinutes, overflow,
                          generatedAt, finishedEarlier, answeredDone } }
}}

settings: { sound, dailyGoalMinutes, dayStartHour }

streak: { count, longest, lastActiveDate,
          history{date:true}, activity{date:n}, minutes{date:n}, planMet{date:true} }
```

Theme preference lives separately in `localStorage` key `planlyTheme` (read synchronously by `theme-init.js`).

## 5. Message contract (UI/content → background)
| Message | Purpose |
|---|---|
| `CURRICULUM_SCRAPED` | Content script sends a scrape; background merges |
| `GET_STATE` | Returns `{courses, plans, settings, streak}` + logical `today` |
| `GENERATE_PLAN` | `{courseId, minutes}` → builds today's plan |
| `ADJUST_PLAN` | `{courseId, mode: keep\|remove\|topup}` |
| `TOGGLE_MANUAL` | `{courseId, taskId}` manual watched tick/undo |
| `SAVE_SETTINGS` | Persist settings |
| `RESTORE_STATE` | Import from Excel backup |
| `PLANLY_SYNC_ALL` / `PLANLY_SCRAPE_NOW` | Background/UI → content script |

All responses are `{ ok: true, ... }` or `{ ok: false, error }`.

## 6. Key algorithms
- **Scrape:** candidate selector lists in `CANDIDATE_SELECTORS`; rows keyed by position; nested/duplicate matches removed; completion read from checkbox state first.
- **Merge:** replace per module present in the scrape; keep absent modules.
- **Plan (`greedySchedule`):** remaining items sorted by `order`; add while `used + cost <= budget`; stop at first miss; first item may overflow.
- **Day boundary:** `logicalNow = now − dayStartHour`; all dates are local, not UTC.
- **Streak:** from `planMet` days, in `syncPlanCompletion()`; heatmap shading from `minutes` vs daily goal.

## 7. Security & privacy
- No remote code, no network, no analytics. Everything stays in `chrome.storage.local`.
- MV3 CSP respected: no inline scripts; external JS files only.
- Content script never runs in or clicks the video player (`PLAYER_SELECTOR` guard).
