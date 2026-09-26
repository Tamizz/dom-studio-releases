'use strict';
// Typing a param into the URL changes panel for this recording only.
const path = require('path');
const { launch, waitFor, clickIn, snap, printSnap } = require('./lib');
if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <path to the DOM Studio app source>');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
(async () => {
  const server = require('./site');
  const { eapp, win } = await launch(APP);
  try {
    await win.evaluate((u) => navigateTo(u), 'http://127.0.0.1:4817/merchant/onboarding-v2?store_id=9&step=menu');
    await waitFor(win, () => state.pageLoaded && /step=menu/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'load');
    await win.waitForTimeout(800);
    await win.evaluate(() => startRecording());
    await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 30000, 'first');
    await win.evaluate(() => { const d = document.getElementById('rec-urls'); d.open = true; });
    await win.click('.rec-param-add');
    await win.keyboard.type('bad name');
    await win.keyboard.press('Enter');
    await win.waitForTimeout(200);
    console.log('-- after invalid name: toast =', await win.evaluate(() => document.querySelector('.toast span')?.textContent), '| + button back:', await win.evaluate(() => !!document.querySelector('.rec-param-add')));
    await win.click('.rec-param-add');
    await win.keyboard.type('modal');
    await win.keyboard.press('Enter');
    await win.waitForTimeout(300);
    console.log('-- chips:', (await win.evaluate(() => [...document.querySelectorAll('.rec-param-chip code')].map((c) => c.textContent))).join(', '), '| rules:', await win.evaluate(() => JSON.stringify(screenParamRules)));
    await clickIn(win, 'desktop', '#help-link');
    await waitFor(win, () => /modal=help/.test(webviewUrlOrAttr(el.webview)), null, 8000, 'modal');
    await waitFor(win, () => state.screens.length >= 2 && state.screens.every((s) => s.mobileHtml), null, 8000, 'modal screen');
    printSnap('help modal with ?modal= added for this recording', await snap(win));
    await win.evaluate(() => cancelRecording());
    await win.waitForTimeout(300);
  } finally {
    await eapp.close().catch(() => {});
    server.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
