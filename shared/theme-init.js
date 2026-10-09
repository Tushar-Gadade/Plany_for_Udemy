// Applies the saved theme before first paint so pages never flash the wrong colours.
// (External file: Manifest V3 extension pages can't run inline scripts.)
try { if (localStorage.getItem('planlyTheme') === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
