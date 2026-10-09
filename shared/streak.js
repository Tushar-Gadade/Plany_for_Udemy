/**
 * Udemy Planly — streak visuals
 *  renderFlames(el)             one big blue-flame animation, always on
 *  renderDayDots(el, streak)    the last 7 days as circles
 *  renderMonthTiles(el, streak) three month heatmaps, LeetCode-style; hover a day for the time studied
 */

// ── hover tooltip: date · time studied · lectures finished ──
let _tip = null;
function tipEl() {
  if (!_tip) { _tip = document.createElement('div'); _tip.className = 'heat-tip'; document.body.appendChild(_tip); }
  return _tip;
}
function studiedLine(min, n) {
  if (min > 0) return `${formatMinutes(min)} studied`;
  return n > 0 ? 'time not recorded' : 'no study';
}
function bindHeatTips(container) {
  const show = (e) => {
    const t = e.target.closest && e.target.closest('[data-date]');
    const tip = tipEl();
    if (!t || !container.contains(t)) { tip.classList.remove('on'); return; }
    const n = +t.dataset.n || 0, min = +t.dataset.min || 0, future = t.dataset.future === '1';
    const goalLine = future || min <= 0 ? '' : `<span class="${min >= goalMinutes() ? 'tip-met' : ''}">${min >= goalMinutes() ? `goal met (${formatMinutes(goalMinutes())})` : `${formatMinutes(goalMinutes() - min)} short of the ${formatMinutes(goalMinutes())} goal`}</span>`;
    tip.innerHTML = `<b>${escapeHtml(t.dataset.date)}</b><span class="tip-time">${studiedLine(min, n)}</span>${n > 0 ? `<span>${n} lecture${n === 1 ? '' : 's'} finished</span>` : ''}${goalLine}`;
    tip.classList.add('on');
    const r = t.getBoundingClientRect(), tr = tip.getBoundingClientRect();
    const x = Math.max(6, Math.min(window.innerWidth - tr.width - 6, r.left + r.width / 2 - tr.width / 2));
    const y = r.top - tr.height - 8 < 4 ? r.bottom + 8 : r.top - tr.height - 8;
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  };
  container.addEventListener('mouseover', show);
  container.addEventListener('mouseleave', () => tipEl().classList.remove('on'));
}


// The fire: one big flame, always animating, regardless of streak length or whether
// today's goal is met — it never goes out and never freezes. Rendered once; later calls
// are a no-op so the CSS loop animation is never restarted (which would show as a stutter).
let _flameRendered = false;
function renderFlames(el) {
  if (_flameRendered) return;
  _flameRendered = true;
  el.innerHTML = '<i class="flame"></i>';
}

function renderDayDots(el, streak) {
  if (!el._tipBound) { bindHeatTips(el); el._tipBound = true; }
  el.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = logicalDate();
    d.setDate(d.getDate() - i);
    const key = dateKey(d);
    const n = activityOn(streak, key), min = minutesOn(streak, key);
    const met = dayMet(streak, key);
    const partial = !met && min > 0;
    const wrap = document.createElement('div');
    wrap.className = 'day-dot' + (met ? ' on' : '') + (partial ? ' part' : '') + (i === 0 ? ' today' : '');
    if (partial) wrap.style.setProperty('--fill', `${Math.max(12, Math.round((min / goalMinutes()) * 100))}%`);
    wrap.dataset.date = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    wrap.dataset.n = n; wrap.dataset.min = min;
    wrap.innerHTML = `<i>${met ? icon('checkSolid', { size: 13 }) : ''}</i><span>${d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>`;
    el.appendChild(wrap);
  }
}

function monthGrid(streak, year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const today = logicalDate();
  const cells = [];
  const lead = first.getDay();                       // blanks before the 1st (Sun-first weeks)
  for (let i = 0; i < lead; i++) cells.push({ blank: true });
  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(year, month, day);
    const key = dateKey(date);
    const future = date > today;
    const count = future ? 0 : activityOn(streak, key);
    const minutes = future ? 0 : minutesOn(streak, key);
    cells.push({ key, date, count, minutes, level: levelFor(count, minutes), future, isToday: date.getTime() === today.getTime() });
  }
  while (cells.length < 42) cells.push({ blank: true });   // always 6 columns so all tiles share one width
  return cells;
}

function renderMonthTiles(el, streak, months) {
  months = months || 3;
  if (!el._tipBound) { bindHeatTips(el); el._tipBound = true; }
  el.innerHTML = '';
  const now = logicalDate();
  for (let m = months - 1; m >= 0; m--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const tile = document.createElement('div');
    tile.className = 'tile';
    const grid = document.createElement('div');
    grid.className = 'tile-grid';
    let total = 0, totalMin = 0;
    monthGrid(streak, ref.getFullYear(), ref.getMonth()).forEach((c) => {
      const b = document.createElement('b');
      if (c.blank) b.className = 'blank';
      else {
        total += c.count; totalMin += c.minutes;
        b.className = (c.future ? 'future' : 'l' + c.level) + (c.isToday ? ' today' : '');
        b.dataset.date = c.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        b.dataset.n = c.count; b.dataset.min = c.minutes; b.dataset.future = c.future ? '1' : '0';
      }
      grid.appendChild(b);
    });
    const label = document.createElement('div');
    label.className = 'tile-label';
    label.innerHTML = `${ref.toLocaleDateString(undefined, { month: 'short' })}<small>${totalMin > 0 ? formatMinutes(totalMin) : `${total} done`}</small>`;
    tile.appendChild(grid); tile.appendChild(label);
    el.appendChild(tile);
  }
}
