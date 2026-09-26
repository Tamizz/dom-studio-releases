'use strict';
// DoorDash-sized steps (≈40 words, no form) clicked through at a normal pace.
const path = require('path');
const { launch, waitFor, clickIn, snap, printSnap } = require('./lib');

if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <path to the DOM Studio app source>');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
const PACE = Number(process.env.PACE || 2500);

(async () => {
  const server = require('./site');
  const { eapp, win } = await launch(APP);
  try {
    await win.evaluate((u) => navigateTo(u), 'http://127.0.0.1:4817/merchant/onboarding-v2?store_id=3&sparse=1&step=welcome');
    await waitFor(win, () => state.pageLoaded && /step=welcome/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'load');
    await win.waitForTimeout(800);
    const t0 = Date.now();
    await win.evaluate(() => startRecording());
    const log = async (tag) => {
      const s = await snap(win);
      console.log(`${String(Date.now() - t0).padStart(6)}ms ${tag}: ${s.screens.length} screens [${s.screens.map((x) => (x.url.match(/step=([\w-]+)/) || [])[1] + (x.mobile ? '+m' : '')).join(', ')}]  rows: ${s.items.map((i) => i.replace(/\?.*step=/, '')).join(' | ')}`);
    };
    for (const [label, until] of [
      ['Get started', /step=store/],
      ['Continue', /step=menu/],
      ['Continue to packages', /step=choose-package/],
      ['Continue', /step=payment/],
    ]) {
      await win.waitForTimeout(PACE);
      await log(`before "${label}"`);
      await clickIn(win, 'desktop', 'button.primary');
      await waitFor(win, (re) => new RegExp(re).test(webviewUrlOrAttr(el.webview)), until.source, 8000, label);
    }
    await win.waitForTimeout(PACE);
    await log('last step shown');
    await win.waitForTimeout(12000);
    await log('12s later');
    await win.evaluate(() => stopRecording('manual'));
    await waitFor(win, () => !state.recording && !state.savingFlow, null, 90000, 'save');
    const saved = await win.evaluate(() => (state.openData?.screens || []).map((s) => (s.url.match(/step=([\w-]+)/) || [])[1] + (s.mobileHtml ? '+m' : '')));
    console.log(`saved (${saved.length}): ${saved.join(', ')}`);
  } finally {
    await eapp.close().catch(() => {});
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
