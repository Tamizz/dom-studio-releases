'use strict';
// Shared driver for DOM Studio scenario runs (unpacked app under Xvfb).
const path = require('path');
const fs = require('fs');
const os = require('os');
const { _electron: electron } = require('playwright-core');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

async function launch(appDir, { log = false } = {}) {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-user-'));
  const eapp = await electron.launch({
    executablePath: require('electron'),
    args: [appDir, `--user-data-dir=${userData}`, '--no-sandbox'],
    timeout: 60000,
  });
  const win = await eapp.firstWindow();
  const logs = [];
  win.on('console', (m) => {
    const t = m.text();
    logs.push(t);
    if (log && /twin|mirror|follow|step|param/i.test(t)) console.log('   [r]', t.slice(0, 220));
  });
  await win.waitForLoadState('domcontentloaded');
  await win.waitForFunction(() => typeof state !== 'undefined' && !!el && !!el.webview, null, { timeout: 30000 });
  return { eapp, win, logs };
}

async function waitFor(win, fn, arg, ms = 20000, label = '') {
  try {
    await win.waitForFunction(fn, arg, { timeout: ms, polling: 100 });
    return true;
  } catch {
    if (label) console.log(`   (timed out waiting for ${label})`);
    return false;
  }
}

// Real (trusted) click on an element inside the desktop or phone webview,
// through the app's own CDP click — the same path mirrored clicks take.
async function clickIn(win, side, selector) {
  return win.evaluate(
    async ({ side, selector }) => {
      const wv = side === 'mobile' ? el.webviewMobile : el.webview;
      const pt = await wv.executeJavaScript(
        `(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null;
          e.scrollIntoView({ block: 'center', behavior: 'instant' });
          const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
        true
      );
      if (!pt) return { ok: false, why: 'no element' };
      return api.clickAt({ webContentsId: wv.getWebContentsId(), x: pt.x, y: pt.y });
    },
    { side, selector }
  );
}

async function snap(win) {
  return win.evaluate(() => ({
    desk: webviewUrlOrAttr(el.webview),
    phone: webviewUrlOrAttr(el.webviewMobile),
    recording: !!state.recording,
    screens: state.screens.map((s) => ({
      url: s.url,
      name: s.name,
      mobile: !!s.mobileHtml,
      mobileUrl: s.mobileUrl || '',
      layers: (s.layers || []).map((l) => l.name),
    })),
    admitting: state.admittingTake ? state.admittingTake.url : null,
    pendingDesk: state.pendingDesktopTakes.length,
    items: state.recItems.map((it) => `${it.status}:${(it.url || '').replace(/^.*\?/, '?')}`),
  }));
}

async function sendLinkMenu(win) {
  await win.click('#btn-page-menu');
  await win.waitForTimeout(150);
  const items = await win.evaluate(() =>
    Array.from(document.querySelectorAll('.row-menu button')).map((b) => ({
      label: b.getAttribute('aria-label') || b.textContent.trim(),
      disabled: b.disabled,
    }))
  );
  await win.keyboard.press('Escape');
  await win.mouse.click(5, 400);
  await win.evaluate(() => document.querySelectorAll('.row-menu').forEach((m) => m.remove()));
  return items.filter((i) => /Send the/.test(i.label));
}

const short = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '');

function printSnap(tag, s) {
  console.log(`-- ${tag}`);
  console.log(`   desktop: ${short(s.desk)}`);
  console.log(`   phone:   ${short(s.phone)}`);
  console.log(`   screens (${s.screens.length}):`);
  s.screens.forEach((x, i) =>
    console.log(
      `     ${i + 1}. ${short(x.url)}  [${x.name}]${x.mobile ? ' +mobile' : ' (no mobile yet)'}${x.mobileUrl ? ` mobileUrl=${short(x.mobileUrl)}` : ''}${x.layers.length ? ` layers=${x.layers.join(',')}` : ''}`
    )
  );
}

module.exports = { launch, waitFor, clickIn, snap, sendLinkMenu, printSnap, short, OUT };
