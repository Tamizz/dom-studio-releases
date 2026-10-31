'use strict';
// A page that never goes still (cycling hero word, ticker, cookie dialog,
// params stripped by replaceState). Records it in split view and watches the
// right panel: how often a card goes back to "Saving…", and how long until a
// screen is saved. With --click, presses the settling card's button after
// CLICK_AT ms and measures how fast the screen lands.
const path = require('path');
const { launch, waitFor, snap, printSnap } = require('./lib');
if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <app source> [--click]');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
const CLICK = process.argv.includes('--click');
const CLICK_AT = Number(process.env.CLICK_AT || 2500);
const WATCH_MS = Number(process.env.WATCH_MS || 20000);
const server = require('./site-profound');
const HOST = `http://127.0.0.1:${server.PORT}`;

function panel(win) {
  return win.evaluate(() => ({
    t: Date.now(),
    rows: [...document.querySelectorAll('#rec-screens .rec-screen-row')].map((r) => ({
      cls: r.className.replace(/rec-screen-row\s*/, ''),
      num: r.querySelector('.rec-screen-num')?.textContent || '',
      name: r.querySelector('.rec-screen-name')?.textContent || '',
      meta: r.querySelector('.rec-screen-meta')?.textContent || '',
      btn: [...r.querySelectorAll('.rec-screen-actions button')].map((b) => b.textContent.trim()).join('|'),
    })),
    items: state.recItems.map((it) => `${it.status}#${it.screen}`),
    screens: state.screens.length,
    withMobile: state.screens.filter((s) => s.mobileHtml).length,
    admitting: !!state.admittingTake,
    pendingDesk: state.pendingDesktopTakes.length,
    dock: [...document.querySelectorAll('#flow-dock-track .flow-dock-card')].map(
      (c) => `${c.querySelector('.flow-dock-num')?.textContent}:${c.querySelector('.flow-dock-name')?.textContent}`
    ),
  }));
}

(async () => {
  const { eapp, win, logs } = await launch(APP);
  try {
    await win.evaluate(() => {
      if (state.mode !== 'browser') openBrowser();
    });
    await win.waitForTimeout(500);
    await win.evaluate((u) => { navigateTo(u); return 1; }, `${HOST}/?vector_id=23468020304&vector_source=GOOGLE${process.env.RELOAD ? '&reload=1' : ''}${process.env.PHONELOOP ? '&phoneloop=1' : ''}`);
    await waitFor(win, () => state.pageLoaded && /127\.0\.0\.1/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'load');
    await win.waitForTimeout(Number(process.env.START_AFTER || 600));
    const t0 = Date.now();
    await win.evaluate(() => { startRecording(); return 1; });
    let settlingRuns = 0;
    let wasSettling = false;
    let firstScreenAt = 0;
    let clickedAt = 0;
    let landedAfterClick = 0;
    let last = '';
    while (Date.now() - t0 < WATCH_MS) {
      const p = await panel(win);
      const settling = p.items.some((s) => s.startsWith('settling'));
      if (settling && !wasSettling) settlingRuns += 1;
      wasSettling = settling;
      if (!firstScreenAt && p.screens > 0) firstScreenAt = Date.now() - t0;
      if (clickedAt && !landedAfterClick && p.screens > 0 && p.withMobile === p.screens) landedAfterClick = Date.now() - clickedAt;
      const sig = JSON.stringify([p.rows, p.items, p.screens, p.withMobile, p.admitting, p.pendingDesk]);
      if (sig !== last) {
        last = sig;
        const rows = p.rows.map((r) => `[${r.num ? `#${r.num} ` : ''}${r.name.slice(r.num.length)} · ${r.meta}${r.btn ? ` · btn=${r.btn}` : ''}]`).join(' ');
        console.log(`${String(Date.now() - t0).padStart(6)}ms screens=${p.screens}/${p.withMobile}m admit=${p.admitting} defer=${p.pendingDesk} items=${p.items.join(',')} ${rows}`);
      }
      const ready = process.env.CLICK_WHEN === 'mobile' ? p.rows.some((r) => /Capturing mobile/.test(r.meta)) : true;
      if (CLICK && !clickedAt && ready && Date.now() - t0 >= CLICK_AT) {
        const pressed = await win.evaluate(() => {
          const b = document.querySelector('#rec-screens .rec-screen-row.is-settling .rec-screen-actions button');
          if (!b) return '';
          b.click();
          return b.textContent.trim();
        });
        if (pressed) {
          clickedAt = Date.now();
          console.log(`${String(clickedAt - t0).padStart(6)}ms >>> pressed "${pressed}"`);
        }
      }
      await win.waitForTimeout(250);
    }
    console.log(`\nsettling runs: ${settlingRuns}`);
    console.log(`first screen saved: ${firstScreenAt ? firstScreenAt + ' ms' : 'never'}`);
    if (CLICK) console.log(`screen (with mobile) after press: ${landedAfterClick ? landedAfterClick + ' ms' : clickedAt ? 'never' : 'button never shown'}`);
    printSnap('end', await snap(win));
    const twin = logs.filter((l) => /twin|capture|admit|mobile/i.test(l));
    if (process.env.LOGS) twin.slice(-60).forEach((l) => console.log('   [r]', l.slice(0, 200)));
  } finally {
    await Promise.race([eapp.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);
    server.close();
    process.exit(0);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
