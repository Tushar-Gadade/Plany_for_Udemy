# Udemy Planly 1.3.8

Enter the time you have; Planly picks the **next lectures that fit completely** in it.
Paper-and-cardboard interface, a blue-flame streak, LeetCode-style activity heatmaps, Excel backup.

## Install / update

1. `chrome://extensions` → Developer mode → **Load unpacked** (or **Reload** if already loaded).
2. **Refresh every open Udemy tab.** This matters: a tab that was open before the update keeps
   running the *old* content script (the one that clicked things) until it is reloaded.
3. Open a course player, press the ⟳ button in the Planly popup (or “Sync all modules” on the dashboard).
   Courses saved by 1.2 are rebuilt from scratch on the first sync (their data was collapsed, see below).

## What was wrong, and what changed

### 1. The player playing / pausing / going fullscreen by itself
Root cause: `content-udemy.js` (v1.2) called `.click()` on **every** element with `aria-expanded="false"`
inside anything whose class contained “curriculum”, from a MutationObserver, so it re-fired on every
page change and every 5 s. Udemy's video controls (speed, settings, captions) use `aria-expanded` too,
so those synthetic clicks landed on the player. Nothing else in the extension touches Udemy's page
(checked: no `scripting`, no `executeScript`, no key events; the only page-side click was that line).

Now: scraping is **read-only**. The single place a click can ever be sent is the **Sync** button, only
when you press it; it opens each collapsed *module header* once, reads, and closes them again, and it
refuses to click anything inside the video player. The unused `scripting` and `activeTab` permissions
were removed from the manifest.

### 2. Only the last lecture of every module
Root cause: lecture rows were keyed by their `data-purpose` attribute, and rows in one module share it,
so each row overwrote the previous and one survived. Also, “Mark as completed” was read as *completed*
(the label contains the word), and a 5-minute title could be mistaken for the lecture's length.

Now: rows are keyed by position (`module index + row index`), nested/duplicate matches are removed,
duration comes from the time element itself, completion reads the checkbox state first, and merging is
per module (a partial scrape can no longer shrink the course). The dashboard lists every lecture of
every module (“Expand all”); the module containing your next lecture opens automatically.

### 3. Time-based planning — no AI
Planning is a fixed rule, not a model call: Planly takes the remaining lectures and coding exercises
**strictly in course order**, adding one at a time, and stops the moment the next one would push the
total over your time — so the filled time never overcaps the budget. It never skips ahead to squeeze a
short one in later, and never splits a lecture. The time box defaults to your **daily goal** (Settings),
so pressing "Plan my session" with nothing changed fills exactly that; the dial/typed field (`90`, `90m`,
`1.5h`, `1h 30m`, `1:30`) still lets you plan a different-length session on a given day.

Lectures always use the length shown in Udemy's UI. **Coding exercises and quizzes have no length on
Udemy, so they're a fixed 10 minutes** — not a setting, since there's nothing on the page to base a real
number on. A lecture with no listed length at all (rare) also falls back to 10. If even the very next
item is longer than your whole session, it's still shown, flagged, rather than leaving the day empty.
Lectures you finished — on Udemy, or by ticking them in Planly — are skipped when building the next plan.

### 4. UI (from your spec, your wireframe and the reference images)
- **Streak card**: blue-smoke plate drifting slowly, your blue fire sprite sheet animated behind a flat matte
  plate with just the number (1 flame → 3 → 5 as the streak grows, a dim pilot light at 0), week circles below.
- **Activity**: three month heatmaps (columns = weeks, rows = Sun→Sat) in glowing cyan, brighter for more lectures that day.
- **Study-time dial**: cardboard knob with a gear-toothed collar and red LED, a dotted meter that lights as you
  turn. Drag it, use arrow keys / PageUp / PageDown, or type a time.
- **Page**: matte e-ink look, a very fine powder grain on a neutral light-grey page; cardboard panels and embossed labels.
  The burnt edges and ash were removed in 1.3.1. EB Garamond + Courier Prime, bundled locally.
- The spec's React / Tailwind / Framer Motion snippets were translated to plain CSS/JS: an extension popup has
  no build step, and this avoids shipping a framework for a few animations.

Also fixed on the way: dates used UTC (so “today” flipped at 5:30 AM in India); they are now local.
The first scrape of a course no longer counts already-finished lectures as study activity.

## Watched lectures (1.3.2)
- The popup, the dashboard and **Plan my session** now ask the open Udemy tab to re-read its ticks first (read-only, no clicks),
  so a plan is never built from stale data. The page also re-reads when a lecture's box changes, when a video ends, and every 15 s.
- The plan tracks your session: “2 of 4 watched · 31 min left”, a progress bar, and “Session complete / Plan next”.
- If Udemy didn't tick something you did watch, click its box in the dashboard's curriculum to mark it watched in Planly
  (click again to undo). The planner, progress and streak all count it. Boxes Udemy already ticked can't be overridden.
- Dial panel and sidebar are now e-ink grey.

## 1.3.8: streak now counts finishing your plan, not minutes vs. a goal
- **Changed what makes a day count toward the streak.** It used to compare the minutes you
  studied that day against your daily-goal setting. Now it counts the day the moment you
  finish every lecture in that day's **"Plan my session"** — Udemy-auto or manually ticked,
  it doesn't matter which. Minutes studied no longer factor into the streak at all.
- Once a day is earned this way it stays earned, even if you undo a tick afterward, use
  "Remove finished" / "Top up", or generate another plan later the same day.
- A day with no plan generated, however much you studied, does **not** count — there's
  nothing to "finish" without one.
- **Daily goal** (Settings) still exists, but now only shades the activity heatmap and the
  "today" stat; its description was updated so it no longer claims to drive the streak.
  The "goal met" labels on the streak card now read "plan complete" instead.
- Because the rule changed completely, **your streak will very likely reset** the first time
  you open this version — none of your past days have the new "plan completed" record, only
  going forward will.

## 1.3.7: fire redesign
- The flame sprite is rebuilt at much higher resolution (5x upscale with edge sharpening, vs. 2x before),
  so it stays crisp now that it's rendered far larger.
- **Streak, Activity and Study-time now share one surface**: the same cardboard/e-ink texture and colour
  as the dial panel, replacing the old dark-navy "nebula" card and dark-navy month tiles.
- The streak card's glass pill is gone. The streak number now sits with no box at all, glowing right in
  the core of the flame.
- The fire animation is bigger — sized to fill its card — and now **always animates**, regardless of the
  streak length or whether today's goal is met yet. It never freezes and never goes fully dark.
- Month-heatmap cells now use the app's own accent colour (scaling from pale to bright with the day's
  study time) instead of the separate dark-blue palette, so they read as part of the same theme, light or dark.
- Removed the now-unused smoke-texture and small-ember-frame image assets.

## 1.3.6: real-markup scraper bug fixed
- You sent the actual HTML Udemy renders for a lecture row, and it caught a real bug: one of the row-matching
  selectors (`class` contains `"curriculum-item-link--curriculum-item"`) was also matching that row's own
  **sub-parts** — the title wrapper, the title-content span, the progress-toggle label — because Udemy names
  all of them with the same prefix plus a suffix word (`...-title--`, `...-title-content--`, ...). The old
  wrapper-detection logic then treated the real row as "a wrapper containing multiple items" and kept one of
  those tiny sub-part divs instead — which has no checkbox and no time in it. On a live course this would have
  silently produced **durationMin: 0 (10 min fallback) and completed: false for every single lecture**, regardless
  of its real length or whether you'd actually watched it.
- Fixed: that selector now only matches an element whose class is the row's own (hash directly after `--`, no
  extra BEM word first) — sub-parts are rejected. Added a regression test built from your exact HTML that checks
  the title, the real 7-minute duration, both the not-completed and completed checkbox states, and the section
  name, all against that markup specifically (not just the synthetic fixture used elsewhere).
- If you'd already synced a course before this fix, its completions/durations may be wrong — press Sync again
  after updating.

## 1.3.5: AI removed, coding exercises fixed at 10 min
- Planning no longer has an AI option. It's the same order-preserving, budget-never-overcapped rule described
  above, always. The **Settings → "Ask an AI to plan sessions"** panel, the API key field and the model picker are gone.
- **"Minutes per quiz" is no longer a setting.** Coding exercises / quizzes are always **10 minutes**, fixed.
- The study-time dial/field now **defaults to your daily goal** the first time each page loads, instead of a
  flat 60 minutes, so "Plan my session" with no changes fills your goal. You can still dial or type a different
  time for a particular day; that doesn't change the goal itself.
- `host_permissions` no longer includes `openrouter.ai` — Planly makes no network requests at all now.

## 1.3.3: study time, streak plate, “what next?”
- **Hover a heatmap day** (or a week circle) to see the time you studied and the lectures you finished. Study time is the
  listed length of the lectures you finished that day (quizzes use your “minutes per quiz”), not a stopwatch. Minutes are only
  recorded from this version on; earlier days show “time not recorded”. Heat intensity follows minutes (under 15 / 45 / 90 / more).
  Month tiles show the month's total time. Tiles and cells are smaller.
- **Streak plate**: rounded square, translucent, no blur or gloss, amber number. Streak days as before.
- **Ask me each time**: once you finish some lectures from today's plan, the plan asks: *Top up* (drop finished ones, add the
  next lectures so it covers your full time again), *Remove finished*, or *Keep list* (stops asking until more are finished).

## 1.3.4: daily goal, 4 AM days, dark theme
- **Daily goal** (Settings, default 30 min): a day counts toward your streak only when the lectures you finish that day add up to at
  least the goal. The streak is now calculated from your day-by-day record, so changing the goal re-evaluates your history consistently.
  Today doesn't break a running streak while it's still in progress. Days recorded before 1.3.3 (no minutes) count if you finished
  anything. The week circles show partial progress toward the goal; heatmap colours are relative to it (under half / under / met / double).
  Hovering a day says whether the goal was met. **If your goal is higher than the old “any lecture” rule, your streak number may drop.**
- **A new day starts at 4 AM** (Settings: midnight, 3, 4, 5 or 6 AM). Streak, heatmap, today's minutes and the daily plan all use it.
- **Dark e-ink theme**: switch from the popup (moon/sun button), the dashboard sidebar, or Settings. It is remembered across all pages.

## Known limits (please read)
- I couldn't open Udemy from my environment, so the scraper was tested against a fixture that mimics the
  player (lazy accordion, video controls with `aria-expanded`, the colliding-`data-purpose` pattern), not
  the live site. If counts look off, open DevTools on the player, inspect one lecture row, and add its
  selector to the top of `CANDIDATE_SELECTORS` in `content-udemy.js`.
- Sync needs the sidebar to be present. If Udemy hides it (narrow window / theatre mode), widen the window first.
- Item IDs are position-based: if an instructor inserts a lecture mid-course, later manual ticks may shift.

## Assets
- `assets/flame-*.png`: cut from the blue fire sprite sheet you supplied (background keyed out).
- `assets/smoke.jpg`: cropped from the blue smoke image you supplied.
  Both look like third-party stock/AI art. Fine for personal use; check their licences before publishing the extension.
- `assets/fonts`: EB Garamond and Courier Prime (SIL Open Font License, texts included).
- `lib/xlsx.full.min.js`: SheetJS (Apache-2.0). Icons: Heroicons (MIT).
