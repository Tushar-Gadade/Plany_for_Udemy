# PRD — Udemy Planly

**Product:** Udemy Planly (Chrome extension, Manifest V3)
**Current version:** 1.3.8
**One-liner:** Tell Planly how much time you have; it picks the next Udemy lectures that fit completely in that time, and tracks your streak.

---

## 1. Problem
Udemy courses are long and the player gives no help deciding *"what should I watch in the 45 minutes I have today?"*. Learners lose momentum, over-commit, or abandon courses because there's no daily structure and no visible sense of consistency.

## 2. Target users
| User | Need |
|---|---|
| Self-paced Udemy learners (primary) | A daily, realistic slice of a course instead of an open-ended backlog |
| Working professionals / students with fixed study windows | Plans that fit an exact time box (e.g. 30m, 1h 30m) |
| Habit-driven learners | A visible streak and activity heatmap to stay consistent |
| Privacy-conscious users | No accounts, no servers, no network requests, no AI |

## 3. Goals
1. Turn "I have X minutes" into an ordered, never-over-budget list of lectures.
2. Keep progress in sync with Udemy's own completion ticks, without ever interfering with the video player.
3. Motivate daily consistency via a streak tied to *finishing the plan*.
4. Keep all data local and exportable (Excel backup).

## 4. Non-goals
- No AI / LLM planning (removed in 1.3.5).
- No network calls, accounts, cloud sync or analytics.
- No auto-playing, auto-clicking or controlling the Udemy video player.
- No support for platforms other than Udemy; no mobile app.
- No splitting a lecture across days or reordering the course.

## 5. Features

### 5.1 Curriculum capture (content script)
- Reads modules, lectures, quizzes/coding exercises, durations and completion state from the Udemy course-player sidebar.
- Passive, **read-only** scraping on page load, on checkbox change, on video end, and every 15 s.
- **Sync all modules** button: the only place a click is ever sent; opens each collapsed *module header* once, reads, then closes it again. Never clicks inside the video player.
- Per-module merge so a partial scrape never shrinks a course.

### 5.2 Session planner (fixed rule, no AI)
- Input: time box via rotary dial or typed (`90`, `90m`, `1.5h`, `1h 30m`, `1:30`). Defaults to the daily goal.
- Takes remaining items **strictly in course order**, stops the moment the next one would exceed the budget. Never skips ahead, never splits.
- Cost: lecture = Udemy's listed length; quiz / coding exercise = fixed **10 min**; untimed lecture = 10 min.
- If the very next item alone exceeds the budget it is still shown, flagged as overflow.
- Skips items completed on Udemy or ticked manually in Planly.

### 5.3 Plan tracking
- "2 of 4 watched · 31 min left", progress bar, "Session complete / Plan next".
- After finishing some items the plan asks: **Top up** (drop finished, add next to refill the time), **Remove finished**, or **Keep list**.
- Manual "watched" tick in the dashboard curriculum (undoable; cannot override Udemy-ticked items).

### 5.4 Streak
- A day counts when **every lecture in that day's "Plan my session" is finished** (Udemy-auto or manual).
- Once earned, a day stays earned. A day with no plan never counts.
- Blue-flame animated streak card + week circles.
- A "day" starts at a configurable hour (default 4 AM).

### 5.5 Activity heatmap
- Three month tiles (columns = weeks, rows = Sun→Sat), cyan intensity by study minutes (<15 / 45 / 90 / more, relative to daily goal).
- Hover shows minutes studied and lectures finished.

### 5.6 Dashboard (full view) and popup
- **Popup:** quick view — course select, progress, streak, activity, dial, plan, sync, theme, settings.
- **Dashboard:** course list sidebar, full curriculum tree (expand/collapse all, next lecture's module auto-opens), stats ring, plan card, export/import.

### 5.7 Settings (options page)
- Sound on/off, dark theme, daily goal (1–600 min, default 30), day-start hour (0, 3, 4, 5, 6 AM).

### 5.8 Backup
- Export to `.xlsx` (Courses, Curriculum, Plans, streak sheets) and import back, via SheetJS bundled locally.

### 5.9 Theming
- Light and dark "e-ink / cardboard" themes, remembered across all pages. See `Design.md`.

## 6. Success criteria
- Plans never exceed the chosen time except the flagged single-item overflow.
- Every lecture of every module is captured (not just the last per module).
- Zero unsolicited clicks on the Udemy page.
- Streak result is deterministic from stored data.
- Extension requests only the `storage` permission and `https://www.udemy.com/*`.

## 7. Constraints & assumptions
- Chrome (MV3), desktop. Plain HTML/CSS/JS, no build step.
- Scraper tested against a fixture and one real row of Udemy markup, not the live site; Udemy can change its DOM at any time.
- Item IDs are position-based (`module index + row index`); instructor edits mid-course can shift manual ticks.
- Flame art and fonts: check licences before publishing to the Chrome Web Store.

## 8. Open questions / future ideas
- Chrome Web Store publication (icons, store listing, asset licence check).
- More resilient item IDs (e.g. hashing title + position).
- Multi-course "today" plan across several courses.
- Per-course daily goals.
- Cross-device backup via file only (still no server).
