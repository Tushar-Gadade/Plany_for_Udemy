/**
 * Udemy Planly — shared client utilities
 * Loaded before popup.js / dashboard.js in their respective HTML files.
 */

function sendMsg(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, resolve));
}

// Ask the open Udemy course-player tab to do something (e.g. PLANLY_SYNC_ALL).
async function sendToUdemyTab(msg) {
  let tabs = [];
  try {
    tabs = await chrome.tabs.query({ url: 'https://www.udemy.com/course/*/learn/*' });
  } catch (e) { /* no tabs API */ }
  if (!tabs.length) return { ok: false, error: 'no-tab' };
  const tab = tabs.find((t) => t.active && t.currentWindow) || tabs[0];
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, msg, (res) => {
      if (chrome.runtime.lastError || !res) resolve({ ok: false, error: 'no-listener' });
      else resolve(res);
    });
  });
}

// ── study preferences (set from Settings; see setStudyPrefs) ──────────────
let _goal = 30;        // minutes of lectures finished per day for a day to count toward the streak
let _dayStart = 4;     // a new "day" starts at this hour (4 = 4 AM), so late-night study counts for the day before
function setStudyPrefs(settings) {
  settings = settings || {};
  const g = Number(settings.dailyGoalMinutes);
  _goal = Number.isFinite(g) && g >= 1 ? Math.round(g) : 30;
  const h = Number(settings.dayStartHour);
  _dayStart = Number.isFinite(h) && h >= 0 && h <= 12 ? h : 4;
}
const goalMinutes = () => _goal;

// ── dates (local calendar days, not UTC) ─────────────────────────────────
function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// The current "day" as a local-midnight Date, honouring the day-start hour.
function logicalDate(now) {
  const d = new Date((now ? now.getTime() : Date.now()) - _dayStart * 3600 * 1000);
  d.setHours(0, 0, 0, 0);
  return d;
}
const todayKeyClient = () => dateKey(logicalDate());
function yesterdayKeyClient() {
  const d = logicalDate();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

// ── streak: derived from the per-day record ───────────────────────────────
// A day counts once you finish every lecture in that day's "Plan my session" — not a
// comparison of minutes studied against any time budget. background.js sets planMet[key]
// the moment that happens, and never unsets it, so an earned day can't be taken back.
function dayMet(streak, key) {
  return !!(streak && streak.planMet && streak.planMet[key]);
}
function computeStreak(streak) {
  streak = streak || {};
  const today = logicalDate();
  const todayK = dateKey(today);
  const todayMinutes = minutesOn(streak, todayK);
  const todayMet = dayMet(streak, todayK);
  // today still in progress doesn't break a running streak
  const cursor = new Date(today);
  if (!todayMet) cursor.setDate(cursor.getDate() - 1);
  let count = 0;
  while (dayMet(streak, dateKey(cursor))) { count += 1; cursor.setDate(cursor.getDate() - 1); }

  const keys = Array.from(new Set([...Object.keys(streak.activity || {}), ...Object.keys(streak.minutes || {}), ...Object.keys(streak.history || {}), ...Object.keys(streak.planMet || {})])).sort();
  let longest = 0, run = 0, prev = null;
  for (const k of keys) {
    if (!dayMet(streak, k)) { run = 0; prev = null; continue; }
    const d = new Date(k + 'T12:00:00');
    run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
    prev = d;
    longest = Math.max(longest, run);
  }
  return { count, longest: Math.max(longest, count), todayMet, todayMinutes, goal: _goal, isLive: count > 0 };
}
// Kept under the old name for the pages; settings are applied through setStudyPrefs().
function displayStreak(streak) {
  return computeStreak(streak);
}

function activityOn(streak, key) {
  if (!streak) return 0;
  const a = streak.activity && streak.activity[key];
  if (a) return a;
  return streak.history && streak.history[key] ? 1 : 0;
}
// Minutes of lectures finished on a day (0 when unknown: days recorded before 1.3.3 only have a count).
function minutesOn(streak, key) {
  return (streak && streak.minutes && streak.minutes[key]) || 0;
}
// Heat level 0-4. With minutes: under half the goal, under the goal, goal met, double the goal.
// Without minutes (days recorded before 1.3.3) it falls back to the lecture count.
function levelFor(count, minutes) {
  if (minutes > 0) return minutes < _goal / 2 ? 1 : minutes < _goal ? 2 : minutes < _goal * 2 ? 3 : 4;
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

// LeetCode-style grid: `weeks` columns (Sun→Sat down each column), ending this week.
function buildContribGrid(streak, weeks) {
  const today = logicalDate();
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const todayK = dateKey(today);
  const cols = [];
  const months = [];
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const key = dateKey(date);
      const future = date > today;
      const count = future ? 0 : activityOn(streak, key);
      const minutes = future ? 0 : minutesOn(streak, key);
      col.push({ key, date, count, minutes, level: levelFor(count, minutes), isToday: key === todayK, future });
    }
    cols.push(col);
    const month = col[0].date.getMonth();
    if (month !== lastMonth) {
      months.push({ label: col[0].date.toLocaleDateString(undefined, { month: 'short' }), startCol: w, span: 1 });
      lastMonth = month;
    } else {
      months[months.length - 1].span += 1;
    }
  }
  const total = cols.flat().reduce((s, c) => s + c.count, 0);
  const totalMinutes = cols.flat().reduce((s, c) => s + c.minutes, 0);
  const activeDays = cols.flat().filter((c) => c.count > 0).length;
  return { cols, months, total, totalMinutes, activeDays };
}

function weekMinutes(streak) {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = logicalDate();
    d.setDate(d.getDate() - i);
    n += minutesOn(streak, dateKey(d));
  }
  return n;
}
function weekTotal(streak) {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const d = logicalDate();
    d.setDate(d.getDate() - i);
    n += activityOn(streak, dateKey(d));
  }
  return n;
}

// ── time cost model (mirrors background.js) ──────────────────────────────
// Lectures use the length Udemy lists. A coding exercise/quiz has no length on Udemy,
// so it's always 10 minutes — fixed, not a setting.
const EXERCISE_MINUTES = 10;
function costOf(item) {
  if (item.kind === 'quiz') return EXERCISE_MINUTES;
  return item.durationMin > 0 ? item.durationMin : 10;
}
// true when the minutes shown for this row are an estimate rather than Udemy's real length
function isEstimated(item) {
  return item.kind === 'quiz' || !(item.durationMin > 0);
}

// A lecture is "done" if Udemy ticked it OR you marked it watched in Planly.
function isDone(item, manual) {
  return !!item.completed || !!(manual && manual[item.id]);
}
function manualOf(state, courseId) {
  return ((state.plans || {})[courseId] || {}).manualCompleted || {};
}

function overallProgress(course, settings, manual) {
  const total = course.curriculum.length;
  const completed = course.curriculum.filter((c) => isDone(c, manual)).length;
  const minutesLeft = course.curriculum.filter((c) => !isDone(c, manual)).reduce((sum, c) => sum + costOf(c, settings), 0);
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0, minutesLeft };
}

function groupBySection(curriculum, manual) {
  const map = new Map();
  for (const item of curriculum) {
    const key = item.sectionIndex != null ? item.sectionIndex : item.section;
    if (!map.has(key)) map.set(key, { section: item.section, items: [] });
    map.get(key).items.push(item);
  }
  return Array.from(map.values()).map(({ section, items }) => ({
    section,
    items,
    total: items.length,
    completed: items.filter((i) => isDone(i, manual)).length
  }));
}

function needsRescan(course) {
  return !course || course.schema !== 2;
}

// ── formatting / parsing ─────────────────────────────────────────────────
function formatMinutes(min) {
  min = Math.round(min);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

// "90", "90m", "1.5h", "1h 30m", "1h30", "1:30", "2 hours" → minutes (or null).
// A bare whole number ≤ 12 is read as hours ("2" = 2h); larger is minutes ("45" = 45m).
function parseTimeInput(str) {
  if (str == null) return null;
  const s = String(str).trim().toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return finish(+m[1] * 60 + +m[2]);
  m = s.match(/^\d+(?:\.\d+)?$/);
  if (m) {
    const n = parseFloat(s);
    return finish(s.includes('.') || n <= 12 ? n * 60 : n);
  }
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)?)?$/);
  if (m && (m[1] || m[2])) return finish((m[1] ? parseFloat(m[1]) * 60 : 0) + (m[2] ? parseFloat(m[2]) : 0));
  return null;
  function finish(v) {
    v = Math.round(v);
    return v > 0 ? v : null;
  }
}

function relativeTime(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

// Mounts a paper-style toggle switch into `el`. Plays a soft click if sound.js is loaded.
function mountToggle(el, checked, onChange) {
  el.classList.add('toggle');
  el.classList.toggle('on', !!checked);
  el.innerHTML = '<div class="toggle-knob"></div>';
  el.setAttribute('role', 'switch');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-checked', String(!!checked));
  const flip = () => {
    const next = !el.classList.contains('on');
    el.classList.toggle('on', next);
    el.setAttribute('aria-checked', String(next));
    if (typeof playToggle === 'function') playToggle(next);
    onChange(next);
  };
  el.addEventListener('click', flip);
  el.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); } });
  return {
    setOn: (v) => {
      el.classList.toggle('on', !!v);
      el.setAttribute('aria-checked', String(!!v));
    }
  };
}

// ── theme (light / dark e-ink). Stored in localStorage so every extension page shares it instantly;
//    shared/theme-init.js applies it before first paint. ──
function getTheme() {
  try { return localStorage.getItem('planlyTheme') === 'dark' ? 'dark' : 'light'; } catch (e) { return 'light'; }
}
function setTheme(name) {
  try { localStorage.setItem('planlyTheme', name); } catch (e) {}
  if (name === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}
window.addEventListener && window.addEventListener('storage', (e) => { if (e.key === 'planlyTheme') setTheme(e.newValue === 'dark' ? 'dark' : 'light'); });
