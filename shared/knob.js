/**
 * Udemy Planly — analog knob
 *
 * A cardboard radio dial: dotted meter ring that lights up as you turn,
 * a gear-toothed collar (like the "Balance" reference), a smooth cap with a
 * red LED marker (like "Volume"). 270° sweep, gap at the bottom.
 *
 * Drag it, use the arrow keys / PageUp / PageDown / Home / End, or set it
 * from outside with setValue(). Ticks softly via shared/sound.js.
 *
 * createKnob({ container, min, max, step, value, size, minLabel, maxLabel, ariaLabel, format, onChange })
 *   -> { getValue, setValue(v, {silent}), destroy }
 */
function createKnob(opts) {
  const {
    container, min = 15, max = 480, step = 5, value: initial = 60, size = 150,
    minLabel = '', maxLabel = '', ariaLabel = 'Study time',
    format = (v) => String(v), onChange = () => {}
  } = opts;

  const uid = 'k' + Math.random().toString(36).slice(2, 7);
  const START = -135, END = 135, SWEEP = END - START;
  const c = size / 2;
  const R_TICK = c - 8;
  const R_OUT = c - 25;           // gear tooth tips
  const R_IN = R_OUT - 7;         // gear valleys
  const R_CAP = R_IN - 6;
  const TEETH = 18, DOTS = 29;

  let value = clamp(initial);
  function clamp(v) {
    const snapped = Math.round(v / step) * step;
    return Math.max(min, Math.min(max, snapped));
  }
  const toAngle = (v) => START + ((v - min) / (max - min)) * SWEEP;
  const fromAngle = (deg) => clamp(min + Math.max(0, Math.min(1, (deg - START) / SWEEP)) * (max - min));
  const pt = (r, deg) => { const a = (deg * Math.PI) / 180; return [c + r * Math.sin(a), c - r * Math.cos(a)]; };

  // gear outline: 4 vertices per tooth, softened by a round-joined stroke
  const gearPath = (() => {
    const s = 360 / TEETH, pts = [];
    for (let i = 0; i < TEETH; i++) {
      const a = i * s;
      pts.push(pt(R_IN, a + 0.06 * s), pt(R_OUT, a + 0.22 * s), pt(R_OUT, a + 0.58 * s), pt(R_IN, a + 0.74 * s));
    }
    return 'M' + pts.map((p) => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L') + ' Z';
  })();

  const dots = [];
  for (let i = 0; i < DOTS; i++) {
    const [x, y] = pt(R_TICK, START + (i / (DOTS - 1)) * SWEEP);
    dots.push(`<circle class="knob-dot" data-i="${i}" cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${i % 7 === 0 ? 2.3 : 1.7}"/>`);
  }
  const [lx0, ly0] = pt(R_TICK, START), [lx1, ly1] = pt(R_TICK, END);
  const labels = (minLabel || maxLabel)
    ? `<text x="${lx0 - 2}" y="${ly0 + 14}" text-anchor="middle" font-family="Courier Prime, Courier New, monospace" font-size="10" class="knob-label">${minLabel}</text>
       <text x="${lx1 + 2}" y="${ly1 + 14}" text-anchor="middle" font-family="Courier Prime, Courier New, monospace" font-size="10" class="knob-label">${maxLabel}</text>` : '';

  container.innerHTML = `
    <div class="knob" tabindex="0" role="slider" aria-label="${ariaLabel}" aria-valuemin="${min}" aria-valuemax="${max}" style="width:${size}px;height:${size}px">
      <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="${uid}g" cx=".34" cy=".28" r=".85">
            <stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/>
            <stop offset="1" stop-color="#34322d" stop-opacity=".30"/>
          </radialGradient>
          <radialGradient id="${uid}c" cx=".34" cy=".26" r=".9">
            <stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
            <stop offset="1" stop-color="#34322d" stop-opacity=".28"/>
          </radialGradient>
          <radialGradient id="${uid}led" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffb08a"/><stop offset=".5" stop-color="#ff4a26"/><stop offset="1" stop-color="#b3160a"/></radialGradient>
          <filter id="${uid}b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4"/></filter>
        </defs>
        ${dots.join('')}
        ${labels}
        <!-- socket the knob sits in -->
        <circle cx="${c}" cy="${c}" r="${R_OUT + 7}" fill="rgba(60,58,52,.08)" stroke="rgba(60,58,52,.30)" stroke-width="1.2"/>
        <circle cx="${c}" cy="${c}" r="${R_OUT + 8.2}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1" transform="translate(0 .8)"/>
        <!-- fixed shadow (light comes from the top-left, so it must not rotate) -->
        <circle cx="${c + 2.5}" cy="${c + 5}" r="${R_OUT}" fill="rgba(30,29,26,.42)" filter="url(#${uid}b)"/>
        <g class="knob-rot" style="transform-origin:${c}px ${c}px">
          <path d="${gearPath}" fill="#dcdad3" stroke="#dcdad3" stroke-width="2.4" stroke-linejoin="round"/>
          <circle cx="${c}" cy="${c}" r="${R_CAP}" fill="#e8e6df"/>
          <circle cx="${c}" cy="${ (c - (R_CAP - 10)).toFixed(2) }" r="5" fill="rgba(40,38,34,.30)"/>
          <circle class="knob-led" cx="${c}" cy="${ (c - (R_CAP - 10)).toFixed(2) }" r="3.4" fill="url(#${uid}led)"/>
        </g>
        <!-- fixed lighting over the rotating parts -->
        <circle cx="${c}" cy="${c}" r="${R_IN + 1}" fill="url(#${uid}g)" pointer-events="none"/>
        <circle cx="${c}" cy="${c}" r="${R_CAP + 2.6}" fill="none" stroke="rgba(40,38,34,.38)" stroke-width="1.6" pointer-events="none"/>
        <circle cx="${c}" cy="${c}" r="${R_CAP + 3.8}" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1" pointer-events="none"/>
        <circle cx="${c}" cy="${c}" r="${R_CAP}" fill="url(#${uid}c)" pointer-events="none"/>
        <circle cx="${c}" cy="${c}" r="${R_CAP - 1}" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1" pointer-events="none"/>
      </svg>
    </div>`;

  const root = container.querySelector('.knob');
  const rot = container.querySelector('.knob-rot');
  const dotEls = Array.from(container.querySelectorAll('.knob-dot'));

  function render() {
    const angle = toAngle(value);
    rot.style.transform = `rotate(${angle}deg)`;
    const lit = Math.round(((value - min) / (max - min)) * (DOTS - 1));
    dotEls.forEach((d, i) => {
      const on = i <= lit;
      d.classList.toggle('lit', on);
    });
    root.setAttribute('aria-valuenow', String(value));
    root.setAttribute('aria-valuetext', format(value));
  }

  let last = value;
  function commit(next, silent) {
    next = clamp(next);
    if (next === value) return;
    value = next;
    render();
    if (!silent) {
      if (typeof playTick === 'function' && value !== last) playTick();
      onChange(value);
    }
    last = value;
  }

  function angleAt(clientX, clientY) {
    const r = root.getBoundingClientRect();
    const dx = clientX - (r.left + r.width / 2), dy = clientY - (r.top + r.height / 2);
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;   // clockwise from top
    // the bottom 90° is a dead zone: snap to whichever end it is nearest
    if (deg > END) deg = END;
    if (deg < START) deg = START;
    return deg;
  }

  let dragging = false;
  const down = (e) => { dragging = true; root.setPointerCapture(e.pointerId); root.focus({ preventScroll: true }); commit(fromAngle(angleAt(e.clientX, e.clientY))); };
  const move = (e) => { if (dragging) commit(fromAngle(angleAt(e.clientX, e.clientY))); };
  const up = (e) => { dragging = false; try { root.releasePointerCapture(e.pointerId); } catch (err) {} };
  const key = (e) => {
    const big = step * 6;
    const map = { ArrowUp: step, ArrowRight: step, ArrowDown: -step, ArrowLeft: -step, PageUp: big, PageDown: -big };
    if (e.key in map) { e.preventDefault(); commit(value + map[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); commit(min); }
    else if (e.key === 'End') { e.preventDefault(); commit(max); }
  };
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointermove', move);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('keydown', key);

  render();
  return {
    getValue: () => value,
    setValue: (v, o) => { const silent = !o || o.silent !== false; commit(v, silent); },
    destroy: () => {
      root.removeEventListener('pointerdown', down); root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up); root.removeEventListener('keydown', key);
    }
  };
}
