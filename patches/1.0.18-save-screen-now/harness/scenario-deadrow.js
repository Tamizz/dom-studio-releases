'use strict';
// Leave a page before it is saved and come back to one already recorded:
// the left page's row must not read "Saving…" forever.
const path = require('path');
const { launch, waitFor, clickIn } = require('./lib');
const server = require('./site-profound');
const HOST = `http://127.0.0.1:${server.PORT}`;
(async () => {
  const { eapp, win } = await launch(path.resolve(process.argv[2]));
  await win.evaluate(() => { if (state.mode !== 'browser') openBrowser(); });
  await win.waitForTimeout(400);
  await win.evaluate((u) => { navigateTo(u); return 1; }, `${HOST}/`);
  await waitFor(win, () => state.pageLoaded, null, 20000, 'load');
  await win.waitForTimeout(500);
  await win.evaluate(() => { startRecording(); return 1; });
  await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 20000, 'home saved');
  await clickIn(win, 'desktop', '#to-pricing');
  await waitFor(win, () => [...document.querySelectorAll('#rec-screens .rec-screen-row')].some((r) => /Pricing/.test(r.textContent)), null, 5000, 'pricing row');
  await win.waitForTimeout(700);
  await win.evaluate((u) => { navigateTo(u); return 1; }, `${HOST}/`);
  const rows = () => win.evaluate(() => [...document.querySelectorAll('#rec-screens .rec-screen-row')].map((r) => `${(r.querySelector('.rec-screen-num') || {}).textContent || '-'} ${(r.querySelector('.rec-screen-title') || r.querySelector('.rec-screen-name')).textContent.slice(0, 30)} · ${r.querySelector('.rec-screen-meta').textContent}`));
  for (const t of [1000, 5000, 15000]) {
    await win.waitForTimeout(t - (t === 1000 ? 0 : t === 5000 ? 1000 : 5000));
    console.log(`${String(t / 1000).padStart(3)} s after going back:`, JSON.stringify(await rows()), 'screens', await win.evaluate(() => state.screens.length));
  }
  await Promise.race([eapp.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
  server.close(); process.exit(0);
})();
