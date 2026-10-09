/**
 * Udemy Planly — content script
 *
 * Runs on the Udemy course player page and READS the curriculum sidebar
 * (modules, lectures, durations, completion state), then reports it to the
 * background worker.
 *
 * ── SAFETY: this script never drives the page on its own. ───────────────
 * v1.2 auto-clicked every collapsed toggle it could find, over and over,
 * from a MutationObserver. Udemy's video controls (speed menu, settings,
 * captions…) also use aria-expanded, so those synthetic clicks hit the
 * player and made it play / pause / go fullscreen by itself. That code is
 * gone. Passive scraping only reads the DOM — it never clicks anything.
 *
 * The ONE place a click is ever sent is syncAllSections(), and it only runs
 * when you press the "Sync all modules" button in the Planly popup. It
 * opens each collapsed module header once (never anything inside the video
 * player), scrapes, then closes them again.
 */
(() => {
  if (window.__planlyContentLoaded) return;
  window.__planlyContentLoaded = true;

  const SCHEMA = 2;

  const CANDIDATE_SELECTORS = {
    // Each lecture / quiz / article row inside a module.
    item: [
      '[data-purpose^="curriculum-item-"]',
      '[class*="curriculum-item-link--curriculum-item"]',
      'li[class*="curriculum-item"]',
      'li[data-purpose]'
    ],
    title: [
      '[data-purpose="item-title"]',
      '[class*="item-title"]',
      'span[class*="truncate"]'
    ],
    // One wrapper per module (accordion panel).
    section: [
      '[data-purpose="curriculum-section-container"]',
      'div[data-purpose^="section-panel-"]',
      'div[class*="accordion-panel-module"]',
      'div[class*="section--section"]'
    ],
    sectionTitle: [
      '[data-purpose="section-heading"]',
      'span[class*="section-title"]',
      'h3',
      'h2'
    ]
  };

  // Anything inside these is the video player. We never click in here, and
  // DOM changes here (the progress bar ticks every second) don't trigger scrapes.
  const PLAYER_SELECTOR =
    'video, [data-purpose="video-player"], [class*="video-player"], [class*="control-bar"], ' +
    '[class*="shaka"], [class*="vjs"], [data-purpose*="video-controls"], [class*="video-viewer"]';

  // ── tiny DOM helpers ───────────────────────────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function qAll(root, selectors) {
    for (const sel of selectors) {
      try {
        const found = root.querySelectorAll(sel);
        if (found && found.length) return Array.from(found);
      } catch (e) { /* selector not valid on this build, try the next */ }
    }
    return [];
  }
  function qOne(root, selectors) {
    for (const sel of selectors) {
      try {
        const found = root.querySelector(sel);
        if (found) return found;
      } catch (e) {}
    }
    return null;
  }
  const inPlayer = (el) => !!(el && el.closest && el.closest(PLAYER_SELECTOR));

  // ── durations ──────────────────────────────────────────────────────────
  // Returns minutes (integer) or 0 when the text has no usable time.
  const DURATION_FULL = /^\s*(?:(\d+)\s*(?:hr|hrs|hour|hours|h)\b)?\s*(?:(\d+)\s*(?:min|mins|minute|minutes|m)\b)?\s*(?:(\d+)\s*(?:sec|secs|second|seconds|s)\b)?\s*$/i;

  function parseDurationToMinutes(text) {
    if (!text) return 0;
    const t = String(text).trim();
    if (!t) return 0;
    const clock = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (clock) {
      if (clock[3] !== undefined) return parseInt(clock[1], 10) * 60 + parseInt(clock[2], 10) + (parseInt(clock[3], 10) >= 30 ? 1 : 0);
      return parseInt(clock[1], 10) + (parseInt(clock[2], 10) >= 30 ? 1 : 0); // mm:ss
    }
    const m = t.match(DURATION_FULL);
    if (m && (m[1] || m[2] || m[3])) {
      const h = m[1] ? parseInt(m[1], 10) : 0;
      const mi = m[2] ? parseInt(m[2], 10) : 0;
      const s = m[3] ? parseInt(m[3], 10) : 0;
      return Math.max(1, h * 60 + mi + (s >= 30 ? 1 : 0));
    }
    return 0;
  }

  // Look for a leaf element whose whole text is a duration ("12min", "1hr 5min").
  // This avoids mistaking "Build it in 5 minutes" in a lecture *title* for its length.
  function extractDuration(itemEl) {
    let found = 0;
    const leaves = itemEl.querySelectorAll('span, div, p, time');
    for (const el of leaves) {
      if (el.children.length > 0) continue;
      const txt = (el.textContent || '').trim();
      if (!txt || txt.length > 14) continue;
      const mins = parseDurationToMinutes(txt);
      if (mins) found = mins; // keep the last one; the time sits at the end of the row
    }
    if (found) return found;
    // Fallback: a "12min" style token anywhere in the row text.
    const raw = itemEl.textContent || '';
    const hrMin = raw.match(/(\d+)\s*hr[s]?\s*(\d+)\s*min/i);
    if (hrMin) return parseInt(hrMin[1], 10) * 60 + parseInt(hrMin[2], 10);
    const minOnly = raw.match(/(?:^|[^\w])(\d{1,3})\s*min\b/i);
    if (minOnly) return parseInt(minOnly[1], 10);
    return 0;
  }

  // ── kind: lecture / quiz / other ───────────────────────────────────────
  function detectKind(itemEl, title, rawText) {
    const cls = typeof itemEl.className === 'string' ? itemEl.className : '';
    const hint = `${itemEl.getAttribute('data-purpose') || ''} ${cls}`.toLowerCase();
    const svgHref = Array.from(itemEl.querySelectorAll('svg use'))
      .map((u) => (u.getAttribute('href') || u.getAttribute('xlink:href') || '').toLowerCase()).join(' ');
    const t = title.toLowerCase();
    if (/\bquiz\b/.test(t)) return 'quiz';
    if (/^(?:\d+\.\s*)?(?:assignment|coding exercise|practice test|exam|test)\b/.test(t)) return 'quiz';
    if (/\b\d+\s+questions?\b/i.test(rawText)) return 'quiz';
    if (/quiz|practice-test|coding-exercise/.test(`${hint} ${svgHref}`)) return 'quiz';
    return 'lecture';
  }

  // ── completion ─────────────────────────────────────────────────────────
  // A checkbox's checked state is authoritative when there is one. Otherwise
  // read ARIA labels — carefully: "Mark as completed" means NOT completed yet.
  function isItemCompleted(itemEl) {
    const box = itemEl.querySelector('input[type="checkbox"]');
    if (box) return !!box.checked || box.getAttribute('aria-checked') === 'true';

    const stateEls = itemEl.querySelectorAll('[aria-checked], [aria-pressed]');
    for (const el of stateEls) {
      const v = el.getAttribute('aria-checked') || el.getAttribute('aria-pressed');
      if (v === 'true') return true;
      if (v === 'false') return false;
    }

    const labelled = itemEl.querySelectorAll('[aria-label], [title]');
    for (const el of labelled) {
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || '').toLowerCase();
      if (!label) continue;
      if (/mark (?:as )?(?:in)?complete|mark as done|mark lecture as/.test(label) && !/incomplete|unmark|un-?complete/.test(label)) return false;
      if (/incomplete|unmark|un-?complete/.test(label)) return true;
      if (/^\s*(completed?|done)\s*$/.test(label)) return true;
    }

    const use = itemEl.querySelector('svg use');
    if (use) {
      const href = (use.getAttribute('xlink:href') || use.getAttribute('href') || '').toLowerCase();
      if (/check|complete/.test(href) && !/uncheck|incomplete/.test(href)) return true;
    }
    const cls = typeof itemEl.className === 'string' ? itemEl.className : '';
    return /is-completed|item--completed|completed/i.test(cls);
  }

  // ── scraping ───────────────────────────────────────────────────────────
  function getSectionElements() {
    const all = qAll(document, CANDIDATE_SELECTORS.section);
    // The sidebar can exist twice in the DOM (desktop + hidden overlay). Drop
    // exact duplicates so module numbering stays correct.
    const seen = new Set();
    const out = [];
    for (const el of all) {
      const sig = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      if (seen.has(sig)) continue;
      seen.add(sig);
      out.push(el);
    }
    return out;
  }

  // Real Udemy markup: the class selector below is meant to catch the item ROW
  // ("curriculum-item-link--curriculum-item--<hash>"), but Udemy names sub-parts of
  // that same row with the same prefix plus a BEM suffix word before their own hash
  // ("curriculum-item-link--curriculum-item-title--<hash>", "...-title-content--<hash>",
  // "...-progress-toggle--<hash>", and so on). A loose substring match catches those
  // too, and picks a tiny inner div (just the title, no checkbox, no time) as "the row" —
  // which is why on real pages this silently produced durationMin: 0 and completed: false
  // for everything. A real row's class has the hash directly after "--", with no extra
  // "-word" in between; a sub-part's class has that extra word. This tells them apart.
  const ROW_CLASS_RE = /(?:^|\s)curriculum-item-link--curriculum-item--/;
  function isRowClassMatch(el) {
    const cls = typeof el.className === 'string' ? el.className : (el.getAttribute && el.getAttribute('class')) || '';
    return ROW_CLASS_RE.test(cls);
  }

  // Union of every candidate selector, minus wrappers and nested duplicates,
  // in document order. (Taking only the first selector that matched — and
  // keying rows by data-purpose — is what collapsed each module down to a
  // single lecture in v1.2.)
  function collectItems(root) {
    const set = new Set();
    for (const sel of CANDIDATE_SELECTORS.item) {
      try {
        root.querySelectorAll(sel).forEach((el) => {
          // The loose "class contains curriculum-item-link--curriculum-item" selector also
          // matches that row's own sub-parts (title, progress toggle, ...); only trust it
          // when the class is the row's own, not a sub-part's. Other selectors (li tag,
          // data-purpose) are specific enough on their own and need no extra check.
          if (sel === '[class*="curriculum-item-link--curriculum-item"]' && !isRowClassMatch(el)) return;
          set.add(el);
        });
      } catch (e) {}
    }
    let els = Array.from(set).filter((el) => !inPlayer(el));
    // A matched element that contains 2+ other matched elements is a wrapper (a list), not a row.
    els = els.filter((el) => els.filter((o) => o !== el && el.contains(o)).length < 2);
    // Where a row and its inner element both matched, keep the outermost one.
    els = els.filter((el) => !els.some((o) => o !== el && o.contains(el)));
    els.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    // Rows must look like content (a title or some text), and not be pure chrome.
    return els.filter((el) => (el.textContent || '').trim().length > 0);
  }

  function buildItem(itemEl, sectionIndex, sectionTitle, indexInSection) {
    const titleEl = qOne(itemEl, CANDIDATE_SELECTORS.title);
    const rawText = (itemEl.textContent || '').replace(/\s+/g, ' ').trim();
    const title = (titleEl ? titleEl.textContent : rawText).replace(/\s+/g, ' ').trim().slice(0, 160);
    const kind = detectKind(itemEl, title, rawText);
    return {
      // Position-based id: unique per row, stable while the curriculum is unchanged.
      id: `s${sectionIndex}-i${indexInSection}`,
      order: sectionIndex * 10000 + indexInSection,
      sectionIndex,
      section: sectionTitle,
      title,
      kind,
      durationMin: kind === 'quiz' ? 0 : extractDuration(itemEl),
      completed: isItemCompleted(itemEl)
    };
  }

  function scrapeCurriculum() {
    const sectionEls = getSectionElements();
    const curriculum = [];
    if (sectionEls.length) {
      sectionEls.forEach((sectionEl, si) => {
        const titleEl = qOne(sectionEl, CANDIDATE_SELECTORS.sectionTitle);
        const sectionTitle = (titleEl ? titleEl.textContent : `Module ${si + 1}`).replace(/\s+/g, ' ').trim();
        collectItems(sectionEl).forEach((itemEl, ii) => curriculum.push(buildItem(itemEl, si, sectionTitle, ii)));
      });
    } else {
      collectItems(document).forEach((itemEl, ii) => curriculum.push(buildItem(itemEl, 0, 'Course', ii)));
    }
    return curriculum;
  }

  function scrapeCourseTitle() {
    const h1 = document.querySelector('h1');
    return h1 && h1.textContent.trim()
      ? h1.textContent.trim()
      : document.title.replace(/\s*\|\s*Udemy.*/i, '').trim();
  }

  function getCourseId() {
    const match = window.location.pathname.match(/\/course\/([^/]+)\/learn/);
    return match ? match[1] : window.location.pathname;
  }

  let lastReportAt = 0;
  function reportScrape(reason) {
    const curriculum = scrapeCurriculum();
    if (!curriculum.length) return { sections: 0, items: 0 };
    lastReportAt = Date.now();
    try {
      chrome.runtime.sendMessage({
        type: 'CURRICULUM_SCRAPED',
        payload: {
          schema: SCHEMA,
          courseId: getCourseId(),
          title: scrapeCourseTitle(),
          url: window.location.href,
          curriculum,
          scrapedAt: Date.now(),
          reason
        }
      });
    } catch (e) { /* extension was reloaded; this tab needs a refresh */ }
    return { sections: new Set(curriculum.map((c) => c.sectionIndex)).size, items: curriculum.length };
  }

  // ── passive watching (read-only) ───────────────────────────────────────
  let attempts = 0;
  const initialTimer = setInterval(() => {
    attempts += 1;
    reportScrape('initial-poll');
    if (attempts >= 6) clearInterval(initialTimer);
  }, 5000);

  let debounce = null;
  const observer = new MutationObserver((records) => {
    // Ignore churn inside the video player (progress bar etc.).
    if (records.every((r) => inPlayer(r.target.nodeType === 1 ? r.target : r.target.parentElement))) return;
    clearTimeout(debounce);
    debounce = setTimeout(() => reportScrape('mutation'), 1500);
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'aria-checked', 'aria-pressed', 'aria-expanded', 'checked']
  });

  // Completion ticks Udemy applies via DOM properties don't raise mutations, so listen for them
  // (read-only listeners) and also re-read gently every 15 s while the tab is visible.
  const soon = (reason, ms) => { clearTimeout(debounce); debounce = setTimeout(() => reportScrape(reason), ms); };
  document.addEventListener('change', (e) => { if (e.target && e.target.type === 'checkbox') soon('tick', 700); }, true);
  document.addEventListener('ended', (e) => { if (e.target && e.target.tagName === 'VIDEO') soon('video-ended', 2500); }, true);
  setInterval(() => { if (!document.hidden && Date.now() - lastReportAt > 12000) reportScrape('poll'); }, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) reportScrape('visible'); });

  // ── user-triggered sync (the only code path that clicks) ───────────────
  function findSectionToggle(sectionEl) {
    if (sectionEl.querySelector('video')) return null; // this "section" is the whole page — refuse
    const items = collectItems(sectionEl);
    const toggles = sectionEl.querySelectorAll('[aria-expanded]');
    for (const t of toggles) {
      if (inPlayer(t)) continue;
      if (items.some((it) => it === t || it.contains(t))) continue; // a control inside a lecture row, not the module header
      return t;
    }
    return null;
  }

  // Re-queries the DOM on every step (Udemy may re-render the sidebar after each
  // toggle, which would leave old element references pointing at nothing).
  async function syncAllSections() {
    const initial = getSectionElements().map((sec) => {
      const t = findSectionToggle(sec);
      return t ? t.getAttribute('aria-expanded') : null;
    });
    const opened = [];
    for (let si = 0; si < initial.length; si++) {
      if (initial[si] !== 'false') continue;
      let sectionEl = getSectionElements()[si];
      const toggle = sectionEl && findSectionToggle(sectionEl);
      if (!toggle || toggle.getAttribute('aria-expanded') !== 'false') continue;
      toggle.click();
      opened.push(si);
      for (let i = 0; i < 12; i++) {
        await sleep(125);
        sectionEl = getSectionElements()[si];
        if (sectionEl && collectItems(sectionEl).length > 0) break;
      }
    }
    await sleep(250);
    const result = reportScrape('manual-sync');
    // Put the sidebar back the way it was.
    for (const si of opened.reverse()) {
      const sectionEl = getSectionElements()[si];
      const toggle = sectionEl && findSectionToggle(sectionEl);
      if (toggle && toggle.getAttribute('aria-expanded') === 'true') { toggle.click(); await sleep(60); }
    }
    return { ...result, expanded: opened.length, modules: initial.length };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (!msg) return;
    if (msg.type === 'PLANLY_SYNC_ALL') {
      syncAllSections()
        .then((r) => sendResponse({ ok: true, ...r }))
        .catch((e) => sendResponse({ ok: false, error: String((e && e.message) || e) }));
      return true;
    }
    if (msg.type === 'PLANLY_SCRAPE_NOW') {
      sendResponse({ ok: true, ...reportScrape('manual-scan') });
    }
  });
})();
