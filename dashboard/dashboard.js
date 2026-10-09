let state = null;
let selectedCourseId = null;
let openSections = new Set();
let allOpen = false;
let knob = null;
let minutes = 60;                 // replaced by the daily-goal default as soon as settings load
let minutesInitialized = false;

const el = (id) => document.getElementById(id);
const RING_C = 2 * Math.PI * 31;
const KNOB_MIN = 15, KNOB_MAX = 480;

function paintTheme() { const dark = getTheme() === 'dark'; el('themeBtn').innerHTML = `${icon(dark ? 'sun' : 'moon', { size: 16 })} ${dark ? 'Light theme' : 'Dark theme'}`; }

function paintStaticIcons() {
  paintTheme();
  el('optionsBtn').innerHTML = `${icon('cog', { size: 16 })} Settings`;
  el('exportBtn').innerHTML = `${icon('externalLink', { size: 16 })} Export to Excel`;
  el('importBtn').innerHTML = `${icon('arrowPath', { size: 16 })} Import from Excel`;
  el('emptyIcon').innerHTML = icon('squares2x2', { size: 26 });
  el('generateIcon').innerHTML = icon('sparklesSolid', { size: 16 });
  el('courseLink').innerHTML = `${icon('externalLink', { size: 15 })} Open on Udemy`;
  el('syncBtn').innerHTML = `${icon('arrowPath', { size: 15 })} Sync all modules`;
}

// ── time entry ──────────────────────────────────────────────────────────
function setMinutes(v, { fromKnob = false, fromInput = false } = {}) {
  minutes = v;
  el('timeReadout').textContent = formatMinutes(minutes);
  if (!fromInput) el('timeInput').value = formatMinutes(minutes);
  if (!fromKnob && knob) knob.setValue(Math.max(KNOB_MIN, Math.min(KNOB_MAX, minutes)));
  el('timeInput').classList.remove('invalid');
}
function mountKnob() {
  knob = createKnob({
    container: el('knobHost'), min: KNOB_MIN, max: KNOB_MAX, step: 5, value: minutes, size: 156,
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
function renderSidebar() {
  const list = el('courseList');
  list.innerHTML = '';
  Object.entries(state.courses).forEach(([id, course]) => {
    const { total, completed, pct } = overallProgress(course, state.settings, manualOf(state, id));
    const li = document.createElement('li');
    li.className = 'course-item' + (id === selectedCourseId ? ' active' : '');
    li.innerHTML = `
      <span class="course-item-icon">${icon('academicCap', { size: 19 })}</span>
      <span class="course-item-text">
        <div class="course-item-title">${escapeHtml(course.title)}</div>
        <div class="course-item-sub">${pct}% · ${completed}/${total}</div>
      </span>`;
    li.addEventListener('click', () => { selectedCourseId = id; openSections = new Set(); allOpen = false; renderAll(); });
    list.appendChild(li);
  });
}

function renderHeader(course) {
  el('courseTitle').textContent = course.title;
  el('courseLink').href = course.url;
  const { total, minutesLeft } = overallProgress(course, state.settings, manualOf(state, selectedCourseId));
  const modules = new Set(course.curriculum.map((c) => c.sectionIndex != null ? c.sectionIndex : c.section)).size;
  el('scanText').textContent = total
    ? `${total} lectures in ${modules} module${modules === 1 ? '' : 's'} · last read ${relativeTime(course.scrapedAt)}`
    : 'No lectures captured yet';
  const note = el('scanNote');
  if (needsRescan(course)) {
    note.textContent = 'This course was saved by an older version of Planly. Open it on Udemy and press “Sync all modules” to rescan every lecture.';
    note.className = 'scan-note warn';
  } else if (note.dataset.sticky !== '1') {
    note.className = 'scan-note hidden';
  }
}

function renderProgress(course) {
  const { total, completed, pct, minutesLeft } = overallProgress(course, state.settings, manualOf(state, selectedCourseId));
  el('statCompleted').textContent = completed;
  el('statTotal').textContent = total;
  el('statMinutesLeft').textContent = formatMinutes(minutesLeft);
  el('statModules').textContent = new Set(course.curriculum.map((c) => c.sectionIndex != null ? c.sectionIndex : c.section)).size;
  el('ringLabel').textContent = `${pct}%`;
  const ring = el('ringFg');
  ring.style.strokeDasharray = String(RING_C);
  ring.style.strokeDashoffset = String(RING_C - (pct / 100) * RING_C);
}

function renderStreak() {
  const s = displayStreak(state.streak);
  el('streakNum').textContent = s.count;
  el('streakPill').setAttribute('aria-label', `Day streak: ${s.count}`);
  el('streakPill').title = s.count === 1 ? '1 day streak' : `${s.count} day streak`;
  renderFlames(el('flames'));
  renderDayDots(el('dayDots'), state.streak);
  renderMonthTiles(el('tiles'), state.streak, 3);
  const tm = minutesOn(state.streak, todayKeyClient());
  el('streakFoot').textContent = s.todayMet ? `plan complete · ${formatMinutes(tm)} today` : `${formatMinutes(tm)} studied today`;
  el('streakFoot').classList.toggle('met', s.todayMet);
  const g = buildContribGrid(state.streak, 13);
  el('actTotal').textContent = g.totalMinutes > 0 ? formatMinutes(g.totalMinutes) : g.total;
  el('actTotalLabel').textContent = g.totalMinutes > 0 ? 'studied, last 3 months' : 'lectures, last 3 months';
  el('actDays').textContent = g.activeDays;
  el('actToday').textContent = minutesOn(state.streak, todayKeyClient()) ? formatMinutes(minutesOn(state.streak, todayKeyClient())) : (activityOn(state.streak, todayKeyClient()) ? `${activityOn(state.streak, todayKeyClient())} lec` : '0m');
  el('actBest').textContent = s.longest;
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
    const autoDone = !!item.completed, manualDone = !!manual[taskId];
    if (autoDone || manualDone) { doneCount += 1; doneMin += costOf(item, state.settings); }
    const li = document.createElement('li');
    li.className = 'task-item' + (autoDone || manualDone ? ' completed' : '');
    const cost = costOf(item, state.settings);
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.innerHTML = `
      <div class="task-title">${escapeHtml(item.title)}</div>
      <div class="task-sub">${icon('clock', { size: 12 })}<span class="mono">${isEstimated(item) ? '~' : ''}${cost}m</span> · ${escapeHtml(item.section)}</div>`;
    const right = document.createElement('div');
    right.className = 'task-right';
    if (autoDone) right.innerHTML = `<span class="pill pill-success">${icon('checkSolid', { size: 12 })} Auto</span>`;
    else {
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
  if (asking) el('adjustQ').textContent = `You finished ${doneCount} of ${shown} planned lectures. What should the plan do?`;
  const early = day.finishedEarlier ? `${day.finishedEarlier} finished earlier · ` : '';
  const lec = `${shown} lecture${shown === 1 ? '' : 's'}`;
  el('planSummary').textContent = complete ? `Session complete · ${lec}` : `${lec} · ${planned} of ${asked} min`;
  el('budgetFill').style.width = `${planned ? Math.round((doneMin / planned) * 100) : 0}%`;
  el('planSub').textContent = complete
    ? 'Nice work. Turn the dial and plan the next session whenever you are ready.'
    : doneCount > 0
      ? `${early}${doneCount} of ${shown} watched · ${Math.max(0, planned - doneMin)} min left`
      : day.overflow
        ? `Your next lecture is longer than ${formatMinutes(asked)}; included anyway.`
        : early + (asked - planned > 0 ? `${formatMinutes(asked - planned)} spare, and the next lecture won't fit.` : 'Fills your time exactly.');
  el('planPill').textContent = `${formatMinutes(asked)} session`;
  const status = el('genStatus');
  status.classList.remove('err');
  return true;
}

function renderToday(course) {
  const plan = state.plans[selectedCourseId];
  const day = plan && plan.days && plan.days[todayKeyClient()];
  const has = !!(day && day.taskIds && day.taskIds.length && renderTaskList(course, day));
  el('planResult').classList.toggle('hidden', !has);
  el('planEmpty').classList.toggle('hidden', has);
  el('planPill').classList.toggle('hidden', !has);
  if (!has) el('genStatus').textContent = '';
  return has ? day : null;
}

function renderCurriculumTree(course, day) {
  const manual = manualOf(state, selectedCourseId);
  const groups = groupBySection(course.curriculum, manual);
  const planned = new Set((day && day.taskIds) || []);
  const tree = el('curriculumTree');
  tree.innerHTML = '';
  const nextOpen = groups.findIndex((g) => g.completed < g.total);   // first module with something left

  groups.forEach((group, idx) => {
    const key = `${idx}`;
    const isOpen = allOpen || openSections.has(key);
    const pct = group.total ? Math.round((group.completed / group.total) * 100) : 0;
    const block = document.createElement('div');
    block.className = 'section-block' + (isOpen ? ' open' : '');

    const header = document.createElement('div');
    header.className = 'section-header';
    header.setAttribute('role', 'button');
    header.tabIndex = 0;
    header.innerHTML = `
      <div class="section-left"><span class="section-title">${escapeHtml(group.section)}</span></div>
      <div class="section-right">
        <span class="section-count">${group.completed}/${group.total}</span>
        <div class="section-progress"><i style="width:${pct}%"></i></div>
        <span class="section-chevron">${icon('chevronDown', { size: 16 })}</span>
      </div>`;
    const toggle = () => { if (openSections.has(key)) openSections.delete(key); else openSections.add(key); allOpen = false; renderCurriculumTree(course, day); };
    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });

    const ul = document.createElement('ul');
    ul.className = 'section-items';
    group.items.forEach((item) => {
      const li = document.createElement('li');
      const done = isDone(item, manual);
      li.className = 'section-item' + (done ? ' done' : '') + (!item.completed && manual[item.id] ? ' manual' : '') + (planned.has(item.id) ? ' planned' : '');
      const cost = costOf(item, state.settings);
      li.innerHTML = `
        <span class="section-item-dot" role="checkbox" aria-checked="${done}" tabindex="0" title="${item.completed ? 'Completed on Udemy' : (done ? 'Marked watched in Planly. Click to undo' : 'Click to mark as watched in Planly')}">${done ? icon('checkSolid', { size: 11 }) : ''}</span>
        <span class="section-item-title">${escapeHtml(item.title)}</span>
        ${item.kind === 'quiz' ? '<span class="section-item-kind">quiz</span>' : ''}
        <span class="section-item-time">${isEstimated(item) ? '~' : ''}${cost}m</span>`;
      const dot = li.querySelector('.section-item-dot');
      const flip = async (e) => {
        e.stopPropagation();
        if (item.completed) return;              // Udemy already says done; nothing to override
        await sendMsg({ type: 'TOGGLE_MANUAL', courseId: selectedCourseId, taskId: item.id });
        await refresh();
      };
      dot.addEventListener('click', flip);
      dot.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(e); } });
      ul.appendChild(li);
    });
    block.appendChild(header); block.appendChild(ul);
    tree.appendChild(block);
  });

  if (!openSections.size && !allOpen && nextOpen >= 0 && !tree.dataset.seeded) { openSections.add(String(nextOpen)); tree.dataset.seeded = '1'; renderCurriculumTree(course, day); return; }
  el('curSummary').textContent = `${groups.length} module${groups.length === 1 ? '' : 's'} · ${course.curriculum.length} lectures`;
  el('toggleAllBtn').textContent = allOpen ? 'Collapse all' : 'Expand all';
}

function renderAll() {
  const hasCourses = Object.keys(state.courses).length > 0;
  el('noCourses').classList.toggle('hidden', hasCourses);
  el('main').classList.toggle('hidden', !hasCourses);
  if (!hasCourses) return;
  if (!selectedCourseId || !state.courses[selectedCourseId]) selectedCourseId = Object.keys(state.courses)[0];
  const course = state.courses[selectedCourseId];
  renderSidebar();
  renderHeader(course);
  renderProgress(course);
  renderStreak();
  const day = renderToday(course);
  renderCurriculumTree(course, day);
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
  renderAll();
}

// ── events ──────────────────────────────────────────────────────────────
el('generateBtn').addEventListener('click', async () => {
  const v = parseTimeInput(el('timeInput').value);
  const status = el('genStatus');
  if (v == null) { el('timeInput').classList.add('invalid'); status.textContent = 'Enter a time like 90m, 1.5h or 1:30.'; status.classList.add('err'); return; }
  setMinutes(Math.min(v, 24 * 60));
  el('generateBtn').disabled = true;
  status.classList.remove('err'); status.textContent = 'Planning…';
  await readPageNow();                       // make sure today's ticks are current
  if (typeof playChime === 'function') playChime();
  const res = await sendMsg({ type: 'GENERATE_PLAN', courseId: selectedCourseId, minutes });
  el('generateBtn').disabled = false;
  if (!res || !res.ok) { status.textContent = (res && res.error) || 'Something went wrong.'; status.classList.add('err'); return; }
  await refresh();
});

document.querySelectorAll('#adjustPrompt [data-mode]').forEach((b) => b.addEventListener('click', async () => {
  await sendMsg({ type: 'ADJUST_PLAN', courseId: selectedCourseId, mode: b.dataset.mode });
  await refresh();
}));

el('toggleAllBtn').addEventListener('click', () => { allOpen = !allOpen; openSections = new Set(); renderCurriculumTree(state.courses[selectedCourseId], currentDay()); });
function currentDay() {
  const plan = state.plans[selectedCourseId];
  return plan && plan.days && plan.days[todayKeyClient()];
}

// The only thing in Planly that ever clicks inside a Udemy page — and only when you press this.
el('syncBtn').addEventListener('click', async () => {
  const btn = el('syncBtn'), note = el('scanNote');
  btn.disabled = true;
  note.dataset.sticky = '1'; note.className = 'scan-note'; note.textContent = 'Reading every module from the Udemy tab…';
  const res = await sendToUdemyTab({ type: 'PLANLY_SYNC_ALL' });
  btn.disabled = false;
  if (res.ok) {
    note.textContent = `Synced ${res.items} lecture${res.items === 1 ? '' : 's'} across ${res.sections} module${res.sections === 1 ? '' : 's'}.`;
    await new Promise((r) => setTimeout(r, 300));
    await refresh();
    setTimeout(() => { note.dataset.sticky = ''; note.classList.add('hidden'); }, 3500);
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

// Read-only: asks the open Udemy tab to re-read its sidebar so ticks are current. Never clicks.
async function readPageNow() {
  const r = await sendToUdemyTab({ type: 'PLANLY_SCRAPE_NOW' });
  if (r && r.ok) await new Promise((res) => setTimeout(res, 350));
}

// ── Excel backup (manual snapshot; chrome.storage.local stays the live store) ──
function buildWorkbook(s) {
  const wb = XLSX.utils.book_new();
  const courseRows = Object.entries(s.courses).map(([id, c]) => ({ courseId: id, title: c.title, url: c.url, schema: c.schema || 1, scrapedAt: new Date(c.scrapedAt || 0).toISOString() }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(courseRows), 'Courses');
  const curriculumRows = [];
  Object.entries(s.courses).forEach(([courseId, c]) => c.curriculum.forEach((item) => curriculumRows.push({ courseId, ...item })));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(curriculumRows), 'Curriculum');
  const planRows = [];
  Object.entries(s.plans).forEach(([courseId, plan]) => Object.entries(plan.days || {}).forEach(([date, day]) => {
    planRows.push({ courseId, date, minutes: day.minutes || Math.round((day.hours || 0) * 60), plannedMinutes: day.plannedMinutes || 0, taskIds: (day.taskIds || []).join('|') });
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(planRows), 'Plans');
  const act = s.streak.activity || {};
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
    count: s.streak.count, longest: s.streak.longest, lastActiveDate: s.streak.lastActiveDate,
    activeDates: Object.keys(s.streak.history || {}).sort().join('|'),
    activity: Object.keys(act).sort().map((k) => `${k}:${act[k]}`).join('|'),
    minutes: Object.keys(s.streak.minutes || {}).sort().map((k) => `${k}:${s.streak.minutes[k]}`).join('|')
  }]), 'Streak');
  return wb;
}

el('exportBtn').addEventListener('click', async () => {
  try {
    const out = XLSX.write(buildWorkbook(state), { type: 'array', bookType: 'xlsx' });
    if (window.showSaveFilePicker) {
      const handle = await window.showSaveFilePicker({ suggestedName: 'udemy-planly-backup.xlsx', types: [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
      const w = await handle.createWritable(); await w.write(out); await w.close();
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([out], { type: 'application/octet-stream' }));
      a.download = 'udemy-planly-backup.xlsx'; a.click();
    }
    if (typeof playChime === 'function') playChime();
  } catch (e) { if (e.name !== 'AbortError') alert('Export failed: ' + e.message); }
});

el('importBtn').addEventListener('click', async () => {
  try {
    let file;
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }] });
      file = await handle.getFile();
    } else {
      file = await new Promise((resolve) => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx'; i.onchange = () => resolve(i.files[0]); i.click(); });
    }
    if (!file) return;
    if (!confirm('This will replace your current Planly data with the contents of this file. Continue?')) return;
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const rows = (name) => XLSX.utils.sheet_to_json(wb.Sheets[name] || {});
    const truthy = (v) => v === true || v === 'TRUE' || v === 1 || v === 'true';

    const courses = {};
    rows('Courses').forEach((r) => { courses[r.courseId] = { schema: Number(r.schema) || undefined, title: r.title, url: r.url, scrapedAt: Date.parse(r.scrapedAt) || Date.now(), curriculum: [] }; });
    rows('Curriculum').forEach((r) => {
      if (!courses[r.courseId]) return;
      const { courseId, ...item } = r;
      item.completed = truthy(item.completed);
      ['order', 'sectionIndex', 'durationMin'].forEach((k) => { if (item[k] !== undefined) item[k] = Number(item[k]); });
      item.kind = item.kind || 'lecture';
      courses[courseId].curriculum.push(item);
    });
    const plans = {};
    rows('Plans').forEach((r) => {
      plans[r.courseId] = plans[r.courseId] || { days: {} };
      plans[r.courseId].days[r.date] = { minutes: Number(r.minutes) || Math.round((Number(r.hours) || 0) * 60), plannedMinutes: Number(r.plannedMinutes) || 0, source: r.source, taskIds: String(r.taskIds || '').split('|').filter(Boolean) };
    });
    const sr = rows('Streak')[0];
    const history = {}, activity = {}, minutesMap = {};
    if (sr && sr.activeDates) String(sr.activeDates).split('|').filter(Boolean).forEach((d) => { history[d] = true; });
    if (sr && sr.activity) String(sr.activity).split('|').filter(Boolean).forEach((p) => { const [d, n] = p.split(':'); if (d) activity[d] = Number(n) || 1; });
    if (sr && sr.minutes) String(sr.minutes).split('|').filter(Boolean).forEach((p) => { const [d, n] = p.split(':'); if (d) minutesMap[d] = Number(n) || 0; });
    const streak = sr ? { count: sr.count || 0, longest: sr.longest || 0, lastActiveDate: sr.lastActiveDate || null, history, activity, minutes: minutesMap } : { count: 0, longest: 0, lastActiveDate: null, history: {}, activity: {}, minutes: {} };

    await sendMsg({ type: 'RESTORE_STATE', courses, plans, streak });
    await refresh();
    if (typeof playChime === 'function') playChime();
  } catch (e) { if (e.name !== 'AbortError') alert('Import failed: ' + e.message); }
});

paintStaticIcons();
mountKnob();
refresh();
readPageNow().then(refresh);
