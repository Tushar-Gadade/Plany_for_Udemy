/**
 * Udemy Planly — sound utility
 *
 * Tiny, synthesized UI sounds (no audio files) so there's nothing to
 * license, host, or have fail to load. Respects a "sound on/off" toggle
 * persisted in chrome.storage.local under settings.sound (default: on).
 */

let audioCtx = null;
let soundEnabled = true;

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function setSoundEnabled(v) {
  soundEnabled = v !== false;
}

function tone({ freq = 440, duration = 0.06, type = 'sine', gain = 0.05, glideTo = null }) {
  if (!soundEnabled) return;
  try {
    const c = ctx();
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, c.currentTime + duration);
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    osc.connect(g).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + duration + 0.02);
  } catch (e) {
    /* audio is a nice-to-have, never let it break the UI */
  }
}

// A short, dry tick — for dial rotation increments.
function playTick() {
  tone({ freq: 720, duration: 0.03, type: 'square', gain: 0.035 });
}

// A soft two-note click — for toggle switches / checkboxes.
function playToggle(on) {
  tone({ freq: on ? 520 : 340, duration: 0.05, type: 'sine', gain: 0.05, glideTo: on ? 780 : 260 });
}

// A gentle rising chime — for primary actions (generate plan, save).
function playChime() {
  tone({ freq: 480, duration: 0.09, type: 'sine', gain: 0.045, glideTo: 640 });
  setTimeout(() => tone({ freq: 640, duration: 0.12, type: 'sine', gain: 0.035, glideTo: 880 }), 60);
}

// A warm little flourish — for the streak flame igniting on open.
function playIgnite() {
  tone({ freq: 300, duration: 0.16, type: 'triangle', gain: 0.04, glideTo: 500 });
  setTimeout(() => tone({ freq: 500, duration: 0.14, type: 'triangle', gain: 0.03, glideTo: 700 }), 90);
}
