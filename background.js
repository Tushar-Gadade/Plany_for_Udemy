/**
 * Udemy Planly — background service worker
 *
 * Owns chrome.storage.local state:
 *   courses:  { [courseId]: { title, url, schema, curriculum: [...], scrapedAt } }
 *   plans:    { [courseId]: { days: { [YYYY-MM-DD]: { minutes, taskIds, plannedMinutes, ... } }, manualCompleted } }
 *   settings: { sound, dailyGoalMinutes, dayStartHour }
 *   streak:   { count, longest, lastActiveDate, history, activity, minutes, planMet }
 *
 * Planning is a fixed, non-AI rule: take the remaining lectures/coding exercises in the
 * exact order they appear in the course, filling minutes up to (never over) the budget.
 * A lecture's cost is the length Udemy shows for it. A coding exercise/quiz (no length on
 * Udemy) is always 10 minutes — that number is fixed, not a setting.
 *
 * The streak counts a day once you finish every lecture in that day's "Plan my session"
 * (see syncPlanCompletion below) — NOT a minutes-studied-vs-goal comparison. `dailyGoalMinutes`
 * still exists purely to shade the activity heatmap and the "today" stat; it no longer decides
 * whether a day counts toward the streak.
 */

const SCHEMA = 2;
const DEFAULT_SETTINGS = { sound: true, dailyGoalMinutes: 30, dayStartHour: 4 };
const UNTIMED_LECTURE_MINUTES = 10;   // a lecture with no length shown on Udemy (rare)
const EXERCISE_MINUTES = 10;          // fixed cost of a quiz / coding exercise (no length on Udemy)
const DEFAULT_STREAK = { count: 0, longest: 0, lastActiveDate: null, history: {}, activity: {}, minutes: {}, planMet: {} };

// Local calendar dates (v1.2 used UTC, which flipped "today" at 5:30 AM in India).
// A "day" starts at `dayStartHour` (default 4 AM) so late-night study counts for the day before.
let DAY_START_HOUR = 4;
function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const logicalNow = () => new Date(Date.now() - DAY_START_HOUR * 3600 * 1000);
const todayKey = () => dateKeyFromDate(logicalNow());
function yesterdayKey() {
  const d = logicalNow();
  d.setDate(d.getDate() - 1);
  return dateKeyFromDate(d);
}

async function getAll() {
  const data = await chrome.storage.local.get(['courses', 'plans', 'settings', 'streak']);
  const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  const h = Number(settings.dayStartHour);
  DAY_START_HOUR = Number.isFinite(h) && h >= 0 && h <= 12 ? h : 4;   // refreshed on every call, so it survives worker restarts
  return {
    courses: data.courses || {},
    plans: data.plans || {},
    settings,
    streak: {
      ...DEFAULT_STREAK,
      ...(data.streak || {}),
      history: (data.streak && data.streak.history) || {},
      activity: (data.streak && data.streak.activity) || {},
      minutes: (data.streak && data.streak.minutes) || {},
      planMet: (data.streak && data.streak.planMet) || {}
    }
  };
}

// Records study activity for today: `count` lectures finished, worth `minutes` of lecture time.
// A day only extends the streak once; the per-day tallies feed the heatmap and its hover time.
async function recordActivity(count = 1, minutes = 0) {
  const { streak } = await getAll();
  const today = todayKey();
  const activity = { ...streak.activity, [today]: (streak.activity[today] || 0) + Math.max(1, count) };
  const mins = { ...streak.minutes, [today]: (streak.minutes[today] || 0) + Math.max(0, Math.round(minutes)) };
  if (streak.lastActiveDate === today) {
    await chrome.storage.local.set({ streak: { ...streak, activity, minutes: mins } });
    return;
  }
  const nextCount = streak.lastActiveDate === yesterdayKey() ? streak.count + 1 : 1;
  await chrome.storage.local.set({
    streak: {
      count: nextCount,
      longest: Math.max(streak.longest || 0, nextCount),
      lastActiveDate: today,
      history: { ...streak.history, [today]: true },
      activity,
      minutes: mins
    }
  });
}

// Undo a manual "watched" tick: take its lecture and minutes back off the day it was recorded on.
async function reduceActivity(date, count, minutes) {
  const { streak } = await getAll();
  if (!date || !streak.activity[date]) return;
  const activity = { ...streak.activity, [date]: Math.max(0, streak.activity[date] - count) };
  const mins = { ...streak.minutes, [date]: Math.max(0, (streak.minutes[date] || 0) - Math.round(minutes)) };
  if (!activity[date]) { delete activity[date]; delete mins[date]; }
  await chrome.storage.local.set({ streak: { ...streak, activity, minutes: mins } });
}

// The streak rule: a day counts once every lecture in that day's plan(s) — from "Plan my
// session" — is finished, not a comparison of minutes studied against any time budget.
// Sums across every course with a plan for today (usually just one). "Finished" includes
// items still listed in taskIds that are done, plus items already dropped by a "Remove
// finished" / "Top up" (tracked in finishedEarlier), so removing done items never loses
// credit for them. Once a day is marked met it is never unmarked — regenerating the plan
// or undoing a tick later the same day can't take an already-earned day back.
async function syncPlanCompletion() {
  const { courses, plans, streak } = await getAll();
  const today = todayKey();
  if (streak.planMet && streak.planMet[today]) return; // already earned; nothing to do

  let totalPlanned = 0;
  let totalCompleted = 0;
  for (const [courseId, plan] of Object.entries(plans)) {
    const day = plan && plan.days && plan.days[today];
    if (!day) continue;
    const total = (day.taskIds ? day.taskIds.length : 0) + (day.finishedEarlier || 0);
    if (!total) continue;
    const course = courses[courseId];
    const byId = new Map(((course && course.curriculum) || []).map((c) => [c.id, c]));
    const manual = plan.manualCompleted || {};
    const doneInList = (day.taskIds || []).filter((id) => {
      const it = byId.get(id);
      return it && (it.completed || !!manual[id]);
    }).length;
    totalPlanned += total;
    totalCompleted += doneInList + (day.finishedEarlier || 0);
  }

  if (totalPlanned > 0 && totalCompleted >= totalPlanned) {
    await chrome.storage.local.set({ streak: { ...streak, planMet: { ...streak.planMet, [today]: true } } });
  }
}

// ── merging scrapes ──────────────────────────────────────────────────────
// Udemy may render only the expanded modules, so one scrape can be partial.
// Merge per MODULE: every module present in the scrape replaces what we had
// for that module; modules absent from the scrape are kept untouched.
// Returns the lectures that flipped from not-done to done since last time.
function mergeCurriculum(existing, incoming) {
  const bySection = new Map();
  (existing || []).forEach((it) => {
    if (!bySection.has(it.sectionIndex)) bySection.set(it.sectionIndex, []);
    bySection.get(it.sectionIndex).push(it);
  });
  const prevById = new Map((existing || []).map((it) => [it.id, it]));

  const newlyCompleted = [];
  const incomingBySection = new Map();
  for (const it of incoming) {
    if (!incomingBySection.has(it.sectionIndex)) incomingBySection.set(it.sectionIndex, []);
    incomingBySection.get(it.sectionIndex).push(it);
    const prev = prevById.get(it.id);
    if (prev && !prev.completed && it.completed) newlyCompleted.push(it);
  }
  for (const [idx, items] of incomingBySection) bySection.set(idx, items);

  const curriculum = Array.from(bySection.values()).flat().sort((a, b) => a.order - b.order);
  return { curriculum, newlyCompleted };
}

async function handleScrape(payload) {
  const { courses } = await getAll();
  const existing = courses[payload.courseId];
  const fresh = !existing || existing.schema !== SCHEMA; // old v1.2 data used a broken id scheme
  const { curriculum, newlyCompleted } = fresh
    ? { curriculum: payload.curriculum, newlyCompleted: [] }
    : mergeCurriculum(existing.curriculum, payload.curriculum);
  courses[payload.courseId] = {
    schema: SCHEMA,
    title: payload.title,
    url: payload.url,
    curriculum,
    scrapedAt: payload.scrapedAt
  };
  await chrome.storage.local.set({ courses });
  if (newlyCompleted.length) await recordActivity(newlyCompleted.length, newlyCompleted.reduce((sum, it) => sum + costOf(it), 0));
  await syncPlanCompletion();
  return courses[payload.courseId];
}

// ── planning ─────────────────────────────────────────────────────────────
// Time cost of one row. Lectures ALWAYS use the length Udemy lists (it's in the UI).
// Coding exercises/quizzes have no length on Udemy, so they're always 10 min — fixed,
// not configurable, since there is nothing on the page to base a real number on.
function costOf(item) {
  if (item.kind === 'quiz') return EXERCISE_MINUTES;
  return item.durationMin > 0 ? item.durationMin : UNTIMED_LECTURE_MINUTES;
}

function remainingLectures(curriculum, manualCompleted) {
  const manual = manualCompleted || {};
  return curriculum.filter((c) => !c.completed && !manual[c.id]).sort((a, b) => a.order - b.order);
}

// Take the NEXT lectures/exercises in curriculum order — sequentially, never skipping
// ahead and never splitting one — stopping the moment the next one would push the total
// over the budget, so the filled time never overcaps it. If even the very next item is
// longer than the whole budget it is still returned (flagged `overflow`) so a short
// session isn't left empty.
function greedySchedule(curriculum, minutes, manualCompleted) {
  const budget = Math.max(0, Math.round(minutes));
  const picked = [];
  let used = 0;
  let overflow = false;
  for (const item of remainingLectures(curriculum, manualCompleted)) {
    const cost = costOf(item);
    if (used + cost > budget) {
      if (picked.length === 0) { picked.push(item.id); used += cost; overflow = true; }
      break;
    }
    picked.push(item.id);
    used += cost;
  }
  return { taskIds: picked, plannedMinutes: used, overflow };
}

async function generatePlanForToday(courseId, minutes) {
  const { courses, plans } = await getAll();
  const course = courses[courseId];
  if (!course) throw new Error('Course not found — open the course player tab once so Planly can read it.');
  if (!course.curriculum.length) throw new Error('No lectures captured yet — open the course player and press Sync.');
  const manual = (plans[courseId] && plans[courseId].manualCompleted) || {};

  const result = greedySchedule(course.curriculum, minutes, manual);

  plans[courseId] = plans[courseId] || { days: {} };
  plans[courseId].days[todayKey()] = {
    minutes,
    taskIds: result.taskIds,
    plannedMinutes: result.plannedMinutes,
    overflow: !!result.overflow,
    generatedAt: Date.now()
  };
  await chrome.storage.local.set({ plans });
  await syncPlanCompletion();
  return plans[courseId].days[todayKey()];
}

// Applies the person's answer to "you finished some planned lectures, what now?"
//   keep   – leave the list alone (stop asking until more get finished)
//   remove – drop the finished ones
//   topup  – drop the finished ones, then add the NEXT lectures after the plan so the
//            unfinished part covers the full session time again
async function adjustPlan(courseId, mode) {
  const { courses, plans } = await getAll();
  const course = courses[courseId];
  const plan = plans[courseId];
  const day = plan && plan.days && plan.days[todayKey()];
  if (!course || !day) throw new Error('There is no plan for today yet.');
  const manual = plan.manualCompleted || {};
  const byId = new Map(course.curriculum.map((c) => [c.id, c]));
  const isGone = (id) => { const it = byId.get(id); return !it || it.completed || !!manual[id]; };
  const finished = day.taskIds.filter(isGone);

  if (mode === 'keep') {
    day.answeredDone = finished.length;
  } else {
    let ids = day.taskIds.filter((id) => !isGone(id));
    day.finishedEarlier = (day.finishedEarlier || 0) + finished.length;
    if (mode === 'topup') {
      const lastPlannedOrder = Math.max(-1, ...day.taskIds.map((id) => (byId.get(id) ? byId.get(id).order : -1)));
      let used = ids.reduce((sum, id) => sum + costOf(byId.get(id)), 0);
      const inPlan = new Set(ids);
      for (const it of remainingLectures(course.curriculum, manual)) {
        if (it.order <= lastPlannedOrder || inPlan.has(it.id)) continue;
        const c = costOf(it);
        if (used + c > day.minutes) break;
        ids.push(it.id); used += c;
      }
    }
    ids.sort((a, b) => byId.get(a).order - byId.get(b).order);
    day.taskIds = ids;
    day.plannedMinutes = ids.reduce((sum, id) => sum + costOf(byId.get(id)), 0);
    day.overflow = false;
    day.answeredDone = 0;
  }
  await chrome.storage.local.set({ plans });
  await syncPlanCompletion();
  return day;
}

// ── message router ───────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.type) {
        case 'CURRICULUM_SCRAPED':
          sendResponse({ ok: true, course: await handleScrape(msg.payload) });
          break;
        case 'GET_STATE':
          sendResponse({ ok: true, state: await getAll(), today: todayKey() });
          break;
        case 'GENERATE_PLAN': {
          const minutes = msg.minutes != null ? msg.minutes : Math.round((msg.hours || 1) * 60);
          sendResponse({ ok: true, day: await generatePlanForToday(msg.courseId, minutes) });
          break;
        }
        case 'ADJUST_PLAN':
          sendResponse({ ok: true, day: await adjustPlan(msg.courseId, msg.mode) });
          break;
        case 'SAVE_SETTINGS':
          await chrome.storage.local.set({ settings: msg.settings });
          sendResponse({ ok: true });
          break;
        case 'TOGGLE_MANUAL': {
          const { courses, plans } = await getAll();
          plans[msg.courseId] = plans[msg.courseId] || { days: {} };
          const plan = plans[msg.courseId];
          plan.manualCompleted = plan.manualCompleted || {};
          plan.manualDates = plan.manualDates || {};
          const item = ((courses[msg.courseId] || {}).curriculum || []).find((c) => c.id === msg.taskId);
          const minutes = item ? costOf(item) : 0;
          const nowDone = !plan.manualCompleted[msg.taskId];
          plan.manualCompleted[msg.taskId] = nowDone;
          const undoneDate = plan.manualDates[msg.taskId];
          if (nowDone) plan.manualDates[msg.taskId] = todayKey(); else delete plan.manualDates[msg.taskId];
          await chrome.storage.local.set({ plans });
          if (nowDone) await recordActivity(1, minutes);
          else await reduceActivity(undoneDate, 1, minutes);
          await syncPlanCompletion();
          sendResponse({ ok: true, manualCompleted: plan.manualCompleted });
          break;
        }
        case 'RESTORE_STATE': {
          const toSet = {};
          if (msg.courses) toSet.courses = msg.courses;
          if (msg.plans) toSet.plans = msg.plans;
          if (msg.streak) toSet.streak = msg.streak;
          await chrome.storage.local.set(toSet);
          sendResponse({ ok: true });
          break;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (e) {
      sendResponse({ ok: false, error: String((e && e.message) || e) });
    }
  })();
  return true;
});
