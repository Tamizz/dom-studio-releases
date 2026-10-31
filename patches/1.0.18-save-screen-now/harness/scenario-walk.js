'use strict';
// Two pages on the never-still stand-in. The home page's phone keeps
// reloading (its card sticks on "Capturing mobile…"); /pricing is normal.
//   A: Save screen now on the stuck card, then go to /pricing — it must save
//      on its own, not sit out a stalled phone job.
//   B: go to /pricing while the home card is stuck, press Save screen now on
//      the pricing card — both must save.
//   C: the URL bar's view buttons switch the stage, both ways.
// Each step prints the right panel and the flow strip (number:name).
const path = require('path');
const { launch, waitFor, clickIn } = require('./lib');
const APP = path.resolve(process.argv[2]);
const ONLY = process.argv[3] || 'ABC';
const server = require('./site-profound');
const HOST = `http://127.0.0.1:${server.PORT}`;

const lists = (win) =>
  win.evaluate(() => ({
    panel: [...document.querySelectorAll('#rec-screens .rec-screen-row')].map(
      (r) => `${r.querySelector('.rec-screen-num')?.textContent || '-'}:${(r.querySelector('.rec-screen-title')?.textContent || '').slice(0, 26)}|${r.querySelector('.rec-screen-meta')?.textContent}`
    ),
    dock: [...document.querySelectorAll('#flow-dock-track .flow-dock-card')].map(
      (c) => `${c.querySelector('.flow-dock-num')?.textContent}:${(c.querySelector('.flow-dock-name')?.textContent || '').slice(0, 26)}`
    ),
    screens: state.screens.map((s) => `${s.url.replace(/^https?:\/\/[^/]+/, '')}${s.mobileHtml ? '+m' : ''}`),
    defer: state.pendingDesktopTakes.length,
    admit: state.admittingTake ? state.admittingTake.url.replace(/^https?:\/\/[^/]+/, '') : null,
  }));
const show = async (win, tag) => {
  const l = await lists(win);
  console.log(`-- ${tag}\n   screens: ${l.screens.join(', ') || '(none)'}  admit=${l.admit} defer=${l.defer}\n   panel:   ${l.panel.join('  ')}\n   dock:    ${l.dock.join('  ')}`);
  return l;
};
const press = (win, which) =>
  win.evaluate((which) => {
    const rows = [...document.querySelectorAll('#rec-screens .rec-screen-row.is-settling')];
    const row = which === 'last' ? rows[rows.length - 1] : rows[0];
    const b = row?.querySelector('.rec-screen-actions button');
    if (!b) return '';
    b.click();
    return b.textContent.trim();
  }, which);

async function start(win) {
  await win.evaluate(() => {
    if (state.mode !== 'browser') openBrowser();
  });
  await win.waitForTimeout(400);
  await win.evaluate((u) => { navigateTo(u); return 1; }, `${HOST}/?phoneloop=1`);
  await waitFor(win, () => state.pageLoaded && /127\.0\.0\.1/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'load');
  await win.waitForTimeout(400);
  await win.evaluate(() => { startRecording(); state.flowDockOpen = true; return 1; });
  return waitFor(win, () => [...document.querySelectorAll('#rec-screens .rec-screen-meta')].some((m) => /Capturing mobile/.test(m.textContent)), null, 12000, 'home stuck on phone');
}

(async () => {
  if (ONLY.includes('A')) {
    const { eapp, win } = await launch(APP);
    console.log('==== A: save the stuck card, then walk on');
    await start(win);
    console.log(`   pressed "${await press(win, 'first')}"`);
    await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 8000, 'home saved');
    await show(win, 'home saved');
    const t = Date.now();
    await clickIn(win, 'desktop', '#to-pricing');
    const ok = await waitFor(win, () => state.screens.length >= 2 && !!state.screens[1].mobileHtml, null, 40000, 'pricing saved');
    console.log(`   /pricing saved with mobile: ${ok ? Date.now() - t + ' ms after the click' : 'not within 40 s'}`);
    await win.evaluate(() => renderFlowDock());
    const l = await show(win, 'after /pricing');
    const p = l.panel.map((x) => x.split('|')[0]);
    console.log(`   panel order == dock order: ${JSON.stringify(p) === JSON.stringify(l.dock)}`);
    await Promise.race([eapp.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
  if (ONLY.includes('B')) {
    const { eapp, win, logs } = await launch(APP);
    console.log('==== B: card held behind a stuck one');
    const mark = () => logs.length;
    await start(win);
    await clickIn(win, 'desktop', '#to-pricing');
    const held = await waitFor(win, () => state.pendingDesktopTakes.some((t) => /pricing/.test(t.url)), null, 10000, '');
    console.log(`   variant: ${held ? '/pricing take held behind home' : 'desktop pulled back to home by the phone'}`);
    await show(win, 'home stuck, /pricing held behind it');
    if (process.env.LOGS) console.log('   state:', JSON.stringify(await win.evaluate(() => ({ items: state.recItems.map((it) => `${it.status}:${it.group}:${(it.url || '').replace(/^https?:\/\/[^/]+/, '')}`), admitGroup: state.admittingTake && state.admittingTake.group, deferred: state.pendingDesktopTakes.map((t) => `${t.group}:${t.url.replace(/^https?:\/\/[^/]+/, '')}:${t.trigger}`), desk: webviewUrlOrAttr(el.webview).replace(/^https?:\/\/[^/]+/, '') }))));
    const t = Date.now();
    const from = mark();
    console.log(`   pressed "${await press(win, 'last')}" on the /pricing card`);
    const want = held ? 2 : 1;
    const ok = await waitFor(
      win,
      (want) => state.screens.length >= want && state.screens.every((s) => s.mobileHtml || s.noMobile) && !state.recItems.some((it) => it.status === 'settling'),
      want,
      30000,
      'saved'
    );
    console.log(`   ${held ? 'both saved' : 'home saved, dead row gone'}: ${ok ? Date.now() - t + ' ms after the press' : 'not within 30 s'}`);
    if (process.env.LOGS) logs.slice(from).filter((l) => !/ds-ready/.test(l)).slice(0, 70).forEach((l) => console.log('   [r]', l.slice(0, 190)));
    if (process.env.LOGS) console.log('   state after:', JSON.stringify(await win.evaluate(() => ({ items: state.recItems.map((it) => `${it.status}:${it.group}:${(it.url || '').replace(/^https?:\/\/[^/]+/, '')}`), deferred: state.pendingDesktopTakes.length, desk: webviewUrlOrAttr(el.webview).replace(/^https?:\/\/[^/]+/, '') }))));
    await win.evaluate(() => renderFlowDock());
    const l = await show(win, 'end');
    console.log(`   panel order == dock order: ${JSON.stringify(l.panel.map((x) => x.split('|')[0])) === JSON.stringify(l.dock)}`);
    await Promise.race([eapp.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
  if (ONLY.includes('C')) {
    const { eapp, win } = await launch(APP);
    console.log('==== C: URL bar view buttons');
    await win.evaluate(() => {
      if (state.mode !== 'browser') openBrowser();
    });
    await win.waitForTimeout(400);
    await win.evaluate((u) => { navigateTo(u); return 1; }, `${HOST}/pricing`);
    await waitFor(win, () => state.pageLoaded, null, 20000, 'load');
    await win.waitForTimeout(800);
    const read = () =>
      win.evaluate(() => ({
        view: recBrowseView,
        stage: [...el.app.classList].filter((c) => c.startsWith('rec-browse')).join(' ') || '(desktop)',
        bar: document.getElementById('url-target').hidden ? 'hidden' : [...document.querySelectorAll('#url-target button')].map((b) => `${b.dataset.t}${b.classList.contains('on') ? '*' : ''}`).join(' '),
        viewAs: [...document.querySelectorAll('#ctl-rec-view button')].filter((b) => b.classList.contains('on')).map((b) => b.dataset.v).join(),
        phoneShown: (() => { const r = el.webviewMobile.getBoundingClientRect(); return r.width > 0 && getComputedStyle(el.webviewMobile).visibility !== 'hidden'; })(),
      }));
    console.log('   start          ', JSON.stringify(await read()));
    for (const t of ['desktop', 'mobile', 'both']) {
      await win.click(`#url-target button[data-t="${t}"]`);
      await win.waitForTimeout(500);
      console.log(`   bar → ${t.padEnd(8)}`, JSON.stringify(await read()));
    }
    await win.click('#ctl-rec-view button[data-v="tablet"]');
    await win.waitForTimeout(500);
    console.log('   View as → tablet', JSON.stringify(await read()));
    await win.click('#ctl-rec-view button[data-v="desktop"]');
    await win.waitForTimeout(500);
    console.log('   View as → desktop', JSON.stringify(await read()));
    await win.screenshot({ path: path.join(__dirname, 'out', 'urlbar-desktop.png') });
    await Promise.race([eapp.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  }
  server.close();
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
