'use strict';
// Per-recording screen params + URL changes panel + late step fill-in.
const path = require('path');
const { launch, waitFor, clickIn, snap, printSnap, OUT } = require('./lib');

if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <path to the DOM Studio app source>');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
const BASE = 'http://127.0.0.1:4817/merchant/onboarding-v2';

(async () => {
  const server = require('./site');
  const { eapp, win } = await launch(APP);
  const count = () => win.evaluate(() => state.screens.length);
  const settle = (ms = 3500) => win.waitForTimeout(ms);
  try {
    await win.evaluate((u) => navigateTo(u), `${BASE}?store_id=1&step=menu`);
    await waitFor(win, () => state.pageLoaded && /step=menu/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'load');
    await win.waitForTimeout(800);
    await win.evaluate(() => startRecording());
    await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 30000, 'first screen');
    await settle(1000);

    // 1) ?tab= is not a screen param by default: the tab view stays on the menu screen.
    await clickIn(win, 'desktop', '[data-tab="photos"]');
    await waitFor(win, () => /tab=photos/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'tab=photos');
    await settle();
    printSnap('tab photos (default rules)', await snap(win));

    // Open the URL changes panel and use the row's "+ tab".
    await win.click('#rec-urls > summary');
    await win.waitForTimeout(300);
    const panel = await win.evaluate(() => ({
      chips: [...document.querySelectorAll('.rec-param-chip code')].map((c) => c.textContent),
      rows: [...document.querySelectorAll('.rec-url-row')].map((r) => r.innerText.replace(/\s+/g, ' ').trim()),
      latest: document.getElementById('rec-urls-latest').textContent,
    }));
    console.log('-- panel before + tab:', JSON.stringify(panel, null, 1));
    await win.screenshot({ path: path.join(OUT, 'panel-before.png') });
    await win.click('.rec-url-add:has-text("+ tab")');
    await waitFor(win, () => state.screens.length >= 2 && state.screens.every((s) => s.mobileHtml), null, 15000, 'tab screen');
    await settle(1500);
    printSnap('after + tab (current tab saved)', await snap(win));

    // 2) Now every tab change is a new screen, on both sides.
    await clickIn(win, 'desktop', '[data-tab="hours"]');
    await waitFor(win, () => /tab=hours/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'tab=hours');
    await settle();
    printSnap('tab hours (tab on)', await snap(win));
    await win.screenshot({ path: path.join(OUT, 'panel-after.png') });

    // 3) Drop it again from its chip: back to same-screen.
    const before = await count();
    await win.click('.rec-param-chip:has(code:text-is("tab")) .rec-param-off');
    await win.waitForTimeout(300);
    await clickIn(win, 'desktop', '[data-tab="items"]');
    await waitFor(win, () => /tab=items/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'tab=items');
    await settle();
    console.log(`-- tab dropped: screens ${before} → ${await count()} (expect no change)`);

    // 4) Landing on the wizard without a step; the app writes ?step=welcome 1.5s later.
    const n0 = await count();
    await win.evaluate((u) => navigateTo(u), `${BASE}?store_id=2&late=1`);
    await waitFor(win, () => /store_id=2.*step=welcome/.test(webviewUrlOrAttr(el.webview)), null, 15000, 'late fill');
    await settle(6000);
    const s4 = await snap(win);
    printSnap('late step fill-in', s4);
    console.log(`-- late landing: screens ${n0} → ${s4.screens.length} (expect +1)`);

    const log = await win.evaluate(() => urlLog.map((e) => `${e.side} ${e.page ? 'page' : 'query'} ${e.screen ? 'SCREEN' : 'same'} ${e.changes.map((c) => `${c.k}:${c.from}→${c.to}`).join(',')}`));
    console.log('-- url log:');
    log.forEach((l) => console.log('   ', l));

    await win.evaluate(() => stopRecording('manual'));
    await waitFor(win, () => !state.recording && !state.savingFlow, null, 60000, 'save');
    const saved = await win.evaluate(() => (state.openData?.screens || []).map((s) => `${s.url.replace(/^https?:\/\/[^/]+/, '')}${s.mobileHtml ? ' +mobile' : ''}`));
    console.log(`-- saved (${saved.length}):`);
    saved.forEach((x, i) => console.log(`   ${i + 1}. ${x}`));
    const rulesAfter = await win.evaluate(() => JSON.stringify(screenParamRules));
    console.log('-- rules after stop:', rulesAfter);
  } finally {
    await eapp.close().catch(() => {});
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
