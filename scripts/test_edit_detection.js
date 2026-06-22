/**
 * Edit-detection diagnostic for SiYuan.
 *
 * HOW TO RUN:
 *   1. Open SiYuan Desktop → Help → DevTools (or press Ctrl+Shift+I / Cmd+Option+I)
 *   2. Switch to the Console tab
 *   3. Paste this entire script and press Enter
 *   4. START TYPING in any SiYuan document
 *   5. Wait for "=== DONE ===" to appear (~12 seconds)
 *   6. The results are written to ~/siyuan_edit_test.txt AND printed in the console
 *   7. Copy the file contents (or console output) and send to the developer
 *
 * For mobile: run this as a "Run Snippet" on the mobile device from the desktop plugin dock.
 *   (The snippet will return the DOM snapshot immediately; the live-event part won't work remotely.)
 */

(async () => {
  const lines = [];
  const p = (...args) => {
    const s = args.map(a =>
      (a !== null && typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a)
    ).join(' ');
    lines.push(s);
    console.log(...args);
  };

  p('=== SiYuan edit-detection diagnostic ===');
  p('time:', new Date().toISOString());
  try { p('frontend:', window.siyuan?.config?.system?.name ?? 'unknown'); } catch(_){}

  // ── 1. DOM snapshot ──────────────────────────────────────────────────────
  p('\n--- 1. DOM SNAPSHOT ---');

  const snap = (sel) => {
    const els = [...document.querySelectorAll(sel)];
    return els.map(el => ({
      tag: el.tagName,
      id: el.id || undefined,
      classes: el.className?.substring?.(0, 80) ?? '',
      contenteditable: el.getAttribute('contenteditable'),
      firstChild: el.firstChild?.nodeType === 3
        ? 'TextNode(' + el.firstChild.data?.substring(0, 30) + ')'
        : el.firstChild?.tagName ?? null,
    }));
  };

  p('protyle-wysiwyg elements:', snap('.protyle-wysiwyg').length, snap('.protyle-wysiwyg'));
  p('protyle-title elements:', snap('.protyle-title').length, snap('.protyle-title'));
  p('protyle elements:', snap('.protyle').length);
  p('all [contenteditable]:', snap('[contenteditable]'));

  // Walk up from any contenteditable and show ancestors
  const ces = [...document.querySelectorAll('[contenteditable="true"]')];
  p('\ncontenteditable ancestor chains:');
  ces.forEach((el, i) => {
    const chain = [];
    let cur = el;
    for (let d = 0; d < 8 && cur && cur !== document.body; d++) {
      chain.push((cur.tagName || '?') + (cur.className ? '.' + cur.className.trim().split(/\s+/).join('.').substring(0, 40) : ''));
      cur = cur.parentElement;
    }
    p(`  [${i}] ${chain.join(' > ')}`);
  });

  // ── 2. Live event + mutation capture (12 seconds) ───────────────────────
  p('\n--- 2. LIVE CAPTURE (please type in SiYuan now, 12 seconds) ---');

  const eventLog = [];
  const mutLog   = [];

  // We log once per event type per second to avoid spamming
  const lastSeen = {};
  const logEvent = (kind, e) => {
    const target = e.target;
    const el = target && target.nodeType !== undefined ? target : null;
    const entry = {
      kind,
      phase: e.eventPhase === 1 ? 'CAPTURE' : 'BUBBLE',
      targetTag: el?.tagName ?? '?',
      targetClass: (el?.className ?? '').substring(0, 60),
      contenteditable: el?.getAttribute?.('contenteditable'),
      inProtyleWysiwyg: !!(el?.closest?.('.protyle-wysiwyg')),
      inProtyleTitle:   !!(el?.closest?.('.protyle-title')),
      closestProtyle:   el?.closest?.('.protyle')?.className?.substring(0, 40) ?? null,
      t: Date.now(),
    };
    const key = kind + '|' + entry.inProtyleWysiwyg;
    const now = Date.now();
    if (!lastSeen[key] || now - lastSeen[key] > 1000) {
      lastSeen[key] = now;
      eventLog.push(entry);
    }
  };

  const h_input_cap   = (e) => logEvent('input[capture]', e);
  const h_input_bub   = (e) => logEvent('input[bubble]',  e);
  const h_before_cap  = (e) => logEvent('beforeinput[capture]', e);
  const h_keydown_cap = (e) => {
    if (e.key?.length > 1 && !['Backspace','Delete','Enter'].includes(e.key)) return;
    logEvent('keydown[capture]', e);
  };
  const h_comp_start  = (e) => logEvent('compositionstart[capture]', e);

  document.addEventListener('input',            h_input_cap,  true);
  document.addEventListener('input',            h_input_bub,  false);
  document.addEventListener('beforeinput',      h_before_cap, true);
  document.addEventListener('keydown',          h_keydown_cap, true);
  document.addEventListener('compositionstart', h_comp_start, true);

  let mutInEditor = 0, mutTotal = 0;
  const obs = new MutationObserver((mutations) => {
    mutTotal += mutations.length;
    for (const m of mutations) {
      const node = m.target;
      const el = node.nodeType === Node.ELEMENT_NODE
        ? node
        : node.parentElement;
      const inWysiwyg = !!(el?.closest('.protyle-wysiwyg'));
      const inTitle   = !!(el?.closest('.protyle-title'));
      if (inWysiwyg || inTitle) {
        mutInEditor++;
        const t = Date.now();
        if (mutLog.length === 0 || t - mutLog[mutLog.length-1].t > 500) {
          mutLog.push({
            type: m.type,
            targetTag: el?.tagName,
            targetClass: (el?.className ?? '').substring(0, 60),
            inProtyleWysiwyg: inWysiwyg,
            inProtyleTitle: inTitle,
            t,
          });
        }
      }
    }
  });
  obs.observe(document.body, { characterData: true, childList: true, subtree: true });

  await new Promise(r => setTimeout(r, 12000));

  // Cleanup
  document.removeEventListener('input',            h_input_cap,  true);
  document.removeEventListener('input',            h_input_bub,  false);
  document.removeEventListener('beforeinput',      h_before_cap, true);
  document.removeEventListener('keydown',          h_keydown_cap, true);
  document.removeEventListener('compositionstart', h_comp_start, true);
  obs.disconnect();

  // ── 3. Results ──────────────────────────────────────────────────────────
  p('\n--- 3. RESULTS ---');
  p('events captured:', eventLog.length, '(unique type+location combos, throttled to 1/sec)');
  p('events detail:', eventLog);
  p('\nmutations total (all DOM):', mutTotal);
  p('mutations in editor:', mutInEditor);
  p('mutation samples:', mutLog);

  p('\n--- 4. VERDICT ---');
  const inputFiredInEditor = eventLog.some(e =>
    e.kind.startsWith('input') && e.inProtyleWysiwyg
  );
  const mutFiredInEditor = mutInEditor > 0;
  p('input event reached document AND was inside .protyle-wysiwyg:', inputFiredInEditor);
  p('MutationObserver caught changes inside .protyle-wysiwyg or .protyle-title:', mutFiredInEditor);

  if (!inputFiredInEditor && !mutFiredInEditor) {
    p('SUSPECT: no typing detected at all — either no typing happened, or wrong selector');
    p('contenteditable count visible:', document.querySelectorAll('[contenteditable="true"]').length);
  }

  // ── Write to file (Electron/Desktop only) ───────────────────────────────
  const report = lines.join('\n');
  try {
    const fs   = window.require('fs');
    const os   = window.require('os');
    const path = window.require('path');
    const out  = path.join(os.homedir(), 'siyuan_edit_test.txt');
    fs.writeFileSync(out, report, 'utf8');
    p('\nResults written to:', out);
  } catch (_) {
    p('\n(Desktop fs not available — copy console output above)');
  }

  p('\n=== DONE ===');
  return report;
})();
