let state = null;
let selectedCourseId = null;
let knob = null;
let minutes = 60;                 // replaced by the daily-goal default as soon as settings load
let minutesInitialized = false;   // exact minutes the user asked for (the knob only shows the nearest step)

const el = (id) => document.getElementById(id);
const KNOB_MIN = 15, KNOB_MAX = 480;

function paintTheme() { el('themeBtn').innerHTML = icon(getTheme() === 'dark' ? 'sun' : 'moon', { size: 16 }); }

function paintStaticIcons() {
  paintTheme();
  el('syncBtn').innerHTML = icon('arrowPath', { size: 17 });
  el('expandBtn').innerHTML = icon('externalLink', { size: 16 });
  el('optionsBtn').innerHTML = icon('cog', { size: 17 });
  el('emptyIcon').innerHTML = icon('squares2x2', { size: 20 });
  el('generateIcon').innerHTML = icon('sparklesSolid', { size: 15 });
  el('regenerateBtn').innerHTML = `${icon('clock', { size: 14 })} Change time`;
}

// ── time entry: knob + typed input stay in sync ─────────────────────────
function setMinutes(v, { fromKnob = false, fromInput = false } = {}) {
  minutes = v;
  el('timeReadout').textContent = formatMinutes(minutes);
  if (!fromInput) el('timeInput').value = formatMinutes(minutes);
  if (!fromKnob && knob) knob.setValue(Math.max(KNOB_MIN, Math.min(KNOB_MAX, minutes)));
  el('timeInput').classList.remove('invalid');
}
function mountKnob() {
  knob = createKnob({
    container: el('knobHost'), min: KNOB_MIN, max: KNOB_MAX, step: 5, value: minutes, size: 124,
    minLabel: '15m', maxLabel: '8h', ariaLabel: 'Study time', format: formatMinutes,
    onChange: (v) => setMinutes(v, { fromKnob: true })
  });
  setMinutes(minutes);
}
el('timeInput').addEventListener('input', (e) => {
  const v = parseTimeInput(e.target.value);
  if (v == null) { e.target.classList.add('invalid'); return; }
  setMinutes(Math.min(v, 24 * 60), { fromInput: true });
});
el('timeInput').addEventListener('focus', (e) => setTimeout(() => e.target.select(), 0));
el('timeInput').addEventListener('blur', () => setMinutes(minutes));
el('timeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') el('generateBtn').click(); });

// ── rendering ───────────────────────────────────────────────────────────
function renderCourseOptions() {
  const select = el('courseSelect');
  select.innerHTML = '';
  Object.entries(state.courses).forEach(([id, course]) => {
    const opt = document.createElement('option');
    opt.value = id; opt.textContent = course.title;
    select.appendChild(opt);
  });
  if (!selectedCourseId || !state.courses[selectedCourseId]) selectedCourseId = Object.keys(state.courses)[0] || null;
  if (selectedCourseId) select.value = selectedCourseId;
}

function renderOverview() {
  const course = state.courses[selectedCourseId];
  if (!course) return;
  const { total, completed, pct, minutesLeft } = overallProgress(course, state.settings, manualOf(state, selectedCourseId));
  const modules = new Set(course.curriculum.map((c) => c.sectionIndex != null ? c.sectionIndex : c.section)).size;
  el('scanText').textContent = total
    ? `${completed}/${total} lectures · ${modules} module${modules === 1 ? '' : 's'} · ${formatMinutes(minutesLeft)} left`
    : 'No lectures captured yet';
  el('pctText').textContent = `${pct}%`;
  el('progFill').style.width = `${pct}%`;

  const note = el('scanNote');
  if (needsRescan(course)) {
    note.textContent = 'Saved by an older version. Open this course on Udemy and press sync (top right) to rescan every lecture.';
    note.className = 'scan-note warn';
  } else {
    note.className = 'scan-note hidden';
  }
}

function renderStreak() {
  const s = displayStreak(state.streak);
  el('streakNum').textContent = s.count;
  el('streakPill').setAttribute('aria-label', `Day streak: ${s.count}`);
  el('streakPill').title = s.count === 1 ? '1 day streak' : `${s.count} day streak`;
  renderFlames(el('flames'));
  renderDayDots(el('dayDots'), state.streak);
  renderMonthTiles(el('tiles'), state.streak, 3);
  const todayMin = minutesOn(state.streak, todayKeyClient());
  el('todayTime').textContent = formatMinutes(todayMin);
  el('todayTime').classList.toggle('met', s.todayMet);
  el('todayLabel').textContent = s.todayMet ? 'plan complete' : 'today';
  el('weekTime').textContent = formatMinutes(weekMinutes(state.streak));
  el('bestStreak').textContent = Math.max(s.longest, s.count);
}

function renderTaskList(course, day) {
  const manual = (state.plans[selectedCourseId] || {}).manualCompleted || {};
  const byId = new Map(course.curriculum.map((c) => [c.id, c]));
  const list = el('taskList');
  list.innerHTML = '';
  let shown = 0, doneCount = 0, doneMin = 0;

  day.taskIds.forEach((taskId) => {
    const item = byId.get(taskId);
    if (!item) return;
    shown += 1;
    const autoDone = !!item.completed;
    const manualDone = !!manual[taskId];
    if (autoDone || manualDone) { doneCount += 1; doneMin += costOf(item, state.settings); }
    const li = document.createElement('li');
    li.className = 'task-item' + (autoDone || manualDone ? ' completed' : '');

    const cost = costOf(item, state.settings);
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.innerHTML = `
      <div class="task-title">${escapeHtml(item.title)}</div>
      <div class="task-sub">${icon('clock', { size: 11 })}<span class="mono">${isEstimated(item) ? '~' : ''}${cost}m</span> · ${escapeHtml(item.section)}</div>`;

    const right = document.createElement('div');
    right.className = 'task-right';
    if (autoDone) {
      right.innerHTML = `<span class="pill pill-success">${icon('checkSolid', { size: 11 })} Auto</span>`;
    } else {
      const t = document.createElement('div');
      mountToggle(t, manualDone, async () => { await sendMsg({ type: 'TOGGLE_MANUAL', courseId: selectedCourseId, taskId }); await refresh(); });
      t.setAttribute('aria-label', `Mark "${item.title}" as done`);
      right.appendChild(t);
    }
    li.appendChild(meta); li.appendChild(right);
    list.appendChild(li);
  });
  if (!shown) return false;

  const planned = day.plannedMinutes != null ? day.plannedMinutes : 0;
  const asked = day.minutes || Math.round((day.hours || 1) * 60);
  const complete = doneCount === shown;
  const asking = doneCount > (day.answeredDone || 0) && !complete;
  el('adjustPrompt').classList.toggle('hidden', !asking);
  el('planCard').classList.toggle('asking', asking);
  if (asking) el('adjustQ').textContent = `You finished ${doneCount} of ${shown}:`;
  const early = day.finishedEarlier ? `${day.finishedEarlier} finished earlier · ` : '';
  const lec = `${shown} lecture${shown === 1 ? '' : 's'}`;
  el('planSummary').textContent = complete ? `Session complete · ${lec}` : `${lec} · ${planned} of ${asked} min`;
  el('budgetFill').style.width = `${planned ? Math.round((doneMin / planned) * 100) : 0}%`;
  el('planSub').textContent = complete
    ? 'Nice work. Plan the next one when you are ready.'
    : doneCount > 0
      ? `${early}${doneCount} of ${shown} watched · ${Math.max(0, planned - doneMin)} min left`
      : day.overflow
        ? `Your next lecture is longer than ${formatMinutes(asked)}; included anyway.`
        : early + (asked - planned > 0 ? `${formatMinutes(asked - planned)} spare, and the next lecture won't fit.` : 'Fills your time exactly.');
  el('regenerateBtn').innerHTML = `${icon('clock', { size: 14 })} ${complete ? 'Plan next' : 'Change time'}`;

  const status = el('genStatus');
  status.classList.remove('err');
  return true;
}

function renderToday() {
  const course = state.courses[selectedCourseId];
  const plan = state.plans[selectedCourseId];
  const day = plan && plan.days && plan.days[todayKeyClient()];
  const has = course && day && day.taskIds && day.taskIds.length && renderTaskList(course, day);
  el('planResult').classList.toggle('hidden', !has);
  el('hoursForm').classList.toggle('hidden', !!has);
  if (!has) el('genStatus').textContent = '';
}

async function refresh() {
  const res = await sendMsg({ type: 'GET_STATE' });
  if (!res || !res.ok) return;
  state = res.state;
  setStudyPrefs(state.settings);
  if (!minutesInitialized) {
    minutesInitialized = true;
    setMinutes(Math.max(KNOB_MIN, Math.min(KNOB_MAX, state.settings.dailyGoalMinutes || 30)));
  }
  if (typeof setSoundEnabled === 'function') setSoundEnabled(state.settings.sound !== false);
  const hasCourses = Object.keys(state.courses).length > 0;
  el('noCourses').classList.toggle('hidden', hasCourses);
  el('main').classList.toggle('hidden', !hasCourses);
  if (!hasCourses) return;
  renderCourseOptions();
  renderOverview();
  renderStreak();
  renderToday();
}

// Read-only: asks the open Udemy tab to re-read its sidebar so ticks are current. Never clicks.
async function readPageNow() {
  const r = await sendToUdemyTab({ type: 'PLANLY_SCRAPE_NOW' });
  if (r && r.ok) await new Promise((res) => setTimeout(res, 350));
}

// ── events ──────────────────────────────────────────────────────────────
el('courseSelect').addEventListener('change', (e) => { selectedCourseId = e.target.value; renderOverview(); renderToday(); });

el('generateBtn').addEventListener('click', async () => {
  const v = parseTimeInput(el('timeInput').value);
  if (v == null) { el('timeInput').classList.add('invalid'); el('genStatus').textContent = 'Enter a time like 90m, 1.5h or 1:30.'; el('genStatus').classList.add('err'); return; }
  setMinutes(Math.min(v, 24 * 60));
  el('generateBtn').disabled = true;
  await readPageNow();                       // make sure today's ticks are current
  el('genStatus').classList.remove('err');
  el('genStatus').textContent = 'Planning…';
  if (typeof playChime === 'function') playChime();
  const res = await sendMsg({ type: 'GENERATE_PLAN', courseId: selectedCourseId, minutes });
  el('generateBtn').disabled = false;
  if (!res || !res.ok) { el('genStatus').textContent = (res && res.error) || 'Something went wrong.'; el('genStatus').classList.add('err'); return; }
  await refresh();
});

document.querySelectorAll('#adjustPrompt [data-mode]').forEach((b) => b.addEventListener('click', async () => {
  await sendMsg({ type: 'ADJUST_PLAN', courseId: selectedCourseId, mode: b.dataset.mode });
  await refresh();
}));

el('regenerateBtn').addEventListener('click', () => {
  el('planResult').classList.add('hidden');
  el('hoursForm').classList.remove('hidden');
  el('genStatus').textContent = '';
});

// Sync = the only thing in Planly that ever clicks inside a Udemy page, and only when you press this.
el('syncBtn').addEventListener('click', async () => {
  const btn = el('syncBtn'), note = el('scanNote');
  btn.classList.add('spin'); btn.disabled = true;
  note.className = 'scan-note'; note.textContent = 'Reading every module from the Udemy tab…';
  const res = await sendToUdemyTab({ type: 'PLANLY_SYNC_ALL' });
  btn.classList.remove('spin'); btn.disabled = false;
  if (res.ok) {
    note.textContent = `Synced ${res.items} lecture${res.items === 1 ? '' : 's'} across ${res.sections} module${res.sections === 1 ? '' : 's'}.`;
    setTimeout(refresh, 300);
    setTimeout(() => note.classList.add('hidden'), 3500);
  } else {
    note.className = 'scan-note warn';
    note.textContent = res.error === 'no-tab'
      ? 'Open your course in the Udemy player (a URL with /learn/), then press sync again.'
      : res.error === 'no-listener'
        ? 'Reload the Udemy tab once (Planly was updated), then press sync again.'
        : `Sync failed: ${res.error}`;
  }
});

el('themeBtn').addEventListener('click', () => { setTheme(getTheme() === 'dark' ? 'light' : 'dark'); paintTheme(); });
window.addEventListener('storage', paintTheme);
el('optionsBtn').addEventListener('click', () => chrome.runtime.openOptionsPage());
el('expandBtn').addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('dashboard/dashboard.html') }));

paintStaticIcons();
mountKnob();
refresh();
readPageNow().then(refresh);
