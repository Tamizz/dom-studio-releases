'use strict';
// Regressions: (A) Uber-style item modal vs phone route, (B) phone-side click
// in the wizard, (C) toolbar Back through recorded steps.
const path = require('path');
const { launch, waitFor, clickIn, snap, printSnap } = require('./lib');
if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <path to the DOM Studio app source>');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
const HOST = 'http://127.0.0.1:4817';

async function record(win, url, until) {
  await win.evaluate(() => {
    if (state.mode !== 'browser') openBrowser();
  });
  await win.waitForTimeout(500);
  await win.evaluate((u) => navigateTo(u), url);
  await waitFor(win, (re) => state.pageLoaded && new RegExp(re).test(webviewUrlOrAttr(el.webviewMobile)), until, 20000, 'load');
  await win.waitForTimeout(800);
  await win.evaluate(() => startRecording());
  await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 30000, 'first screen');
  await win.waitForTimeout(800);
}
async function stop(win) {
  await win.evaluate(() => stopRecording('manual'));
  await waitFor(win, () => !state.recording && !state.savingFlow, null, 60000, 'save');
  return win.evaluate(() => (state.openData?.screens || []).map((s) => s.url.replace(/^https?:\/\/[^/]+/, '') + (s.mobileHtml ? ' +m' : '')));
}

(async () => {
  const server = require('./site');
  const { eapp, win } = await launch(APP);
  try {
    // (A)
    await record(win, `${HOST}/store/abc`, '/store/abc');
    await clickIn(win, 'desktop', '[data-item="fries"]');
    await waitFor(win, () => /mod=quickView/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'quickView');
    await win.waitForTimeout(3500);
    printSnap('(A) desktop opened item modal', await snap(win));
    await clickIn(win, 'desktop', '#qclose');
    await win.waitForTimeout(3000);
    printSnap('(A) closed modal', await snap(win));
    console.log('   saved:', (await stop(win)).join(' | '));

    // (B)
    await record(win, `${HOST}/merchant/onboarding-v2?store_id=7&step=welcome`, 'step=welcome');
    await clickIn(win, 'mobile', 'button.primary');
    await waitFor(win, () => /step=store/.test(webviewUrlOrAttr(el.webviewMobile)), null, 8000, 'phone store');
    await waitFor(win, () => /step=store/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'desktop follows');
    await win.waitForTimeout(3000);
    printSnap('(B) phone clicked Get started', await snap(win));

    // (C) walk one more step, then Back twice.
    await clickIn(win, 'desktop', 'button.primary');
    await waitFor(win, () => /step=menu/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'menu');
    await win.waitForTimeout(3000);
    await win.evaluate(() => browseHistory(-1));
    await waitFor(win, () => /step=store/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'back to store');
    await win.waitForTimeout(3000);
    await win.evaluate(() => browseHistory(-1));
    await waitFor(win, () => /step=welcome/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'back to welcome');
    await win.waitForTimeout(3000);
    printSnap('(C) after Back ×2', await snap(win));
    console.log('   saved:', (await stop(win)).join(' | '));
  } finally {
    await eapp.close().catch(() => {});
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
