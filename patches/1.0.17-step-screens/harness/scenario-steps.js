'use strict';
// DoorDash-style wizard: steps live in ?step= on one document.
// Walk welcome → store → menu → choose-package on the desktop while recording,
// open the ?modal=help dialog, and report what DOM Studio did with each hop.
const path = require('path');
const { launch, waitFor, clickIn, snap, sendLinkMenu, printSnap, OUT } = require('./lib');

if (!process.argv[2]) {
  console.error('usage: node ' + path.basename(__filename) + ' <path to the DOM Studio app source>');
  process.exit(2);
}
const APP = path.resolve(process.argv[2]);
const PORT = 4817;
const START = `http://127.0.0.1:${PORT}/merchant/onboarding-v2?store_id=1000`;

(async () => {
  const server = require('./site');
  const { eapp, win } = await launch(APP, { log: !!process.env.LOG });
  console.log('app:', APP);
  try {
    await win.evaluate((u) => navigateTo(u), START);
    await waitFor(win, () => state.pageLoaded && /step=welcome/.test(webviewUrlOrAttr(el.webview)), null, 20000, 'desktop load');
    await waitFor(win, () => /step=welcome/.test(webviewUrlOrAttr(el.webviewMobile)), null, 20000, 'phone load');
    await win.waitForTimeout(800);

    await win.evaluate(() => startRecording());
    await waitFor(win, () => state.screens.length >= 1 && !!state.screens[0].mobileHtml, null, 30000, 'first screen');
    await win.waitForTimeout(1200);
    printSnap('recording started', await snap(win));

    const hop = async (label, selector, until) => {
      const n0 = await win.evaluate(() => state.screens.length);
      const t = Date.now();
      const r = await clickIn(win, 'desktop', selector);
      if (!r || !r.ok) console.log(`   click ${selector} failed`, r);
      await waitFor(win, until, null, 8000, label);
      const got = await waitFor(win, (n) => state.screens.length > n && state.screens.every((x) => x.mobileHtml), n0, 3500);
      if (got) console.log(`   (screen + mobile saved ${Date.now() - t}ms after the click)`);
      await win.waitForTimeout(got ? 600 : 0);
      printSnap(`after desktop click: ${label}`, await snap(win));
    };

    await hop('Get started (welcome → store)', 'button.primary', () => /step=store/.test(webviewUrlOrAttr(el.webview)));
    await hop('Continue (store → menu)', 'button.primary', () => /step=menu/.test(webviewUrlOrAttr(el.webview)));
    // Phone labels this button "Next": the mirrored click cannot match it.
    await hop('Continue to packages (menu → choose-package)', 'button.primary', () => /step=choose-package/.test(webviewUrlOrAttr(el.webview)));

    const menu = await sendLinkMenu(win);
    console.log('-- ⋯ menu, Send link items:');
    menu.forEach((m) => console.log(`   ${m.disabled ? 'DISABLED' : 'enabled '}  ${m.label}`));

    await hop('Help (opens ?modal=help dialog)', '#help-link', () => /modal=help/.test(webviewUrlOrAttr(el.webview)));
    await win.screenshot({ path: path.join(OUT, `steps-${path.basename(APP)}.png`) });

    const stopAt = Date.now();
    await win.evaluate(() => stopRecording('manual'));
    await waitFor(win, () => !state.recording && !state.savingFlow, null, 60000, 'save');
    console.log(`-- Stop → saved in ${Date.now() - stopAt}ms`);
    await win.waitForTimeout(500);
    const saved = await win.evaluate(() =>
      (state.openData?.screens || []).map((s) => `${s.url.replace(/^https?:\/\/[^/]+/, '')}  [${s.name}]${s.mobileHtml ? ' +mobile' : ''}`)
    );
    console.log(`-- saved project screens (${saved.length}):`);
    saved.forEach((s, i) => console.log(`   ${i + 1}. ${s}`));
  } finally {
    await eapp.close().catch(() => {});
    server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
