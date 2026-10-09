const $ = (id) => document.getElementById(id);
let soundToggle, darkToggle;

async function load() {
  const res = await sendMsg({ type: 'GET_STATE' });
  const settings = (res && res.ok && res.state.settings) || {};
  soundToggle = mountToggle($('sound'), settings.sound !== false, (on) => setSoundEnabled(on));
  setSoundEnabled(settings.sound !== false);
  darkToggle = mountToggle($('darkTheme'), getTheme() === 'dark', (on) => setTheme(on ? 'dark' : 'light'));
  $('dailyGoal').value = settings.dailyGoalMinutes || 30;
  $('dayStart').value = String(Number.isFinite(Number(settings.dayStartHour)) ? Number(settings.dayStartHour) : 4);
}

$('saveBtn').addEventListener('click', async () => {
  await sendMsg({
    type: 'SAVE_SETTINGS',
    settings: {
      sound: $('sound').classList.contains('on'),
      dailyGoalMinutes: Math.max(1, Math.min(600, parseInt($('dailyGoal').value, 10) || 30)),
      dayStartHour: parseInt($('dayStart').value, 10)
    }
  });
  if (typeof playChime === 'function') playChime();
  $('status').textContent = 'Saved.';
  setTimeout(() => ($('status').textContent = ''), 2200);
});

load();
