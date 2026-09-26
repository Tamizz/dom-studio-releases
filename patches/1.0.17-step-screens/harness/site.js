'use strict';
// Local stand-in for DoorDash's merchant onboarding: one document, steps in
// ?step=, moved with history.pushState. A help modal lives in ?modal= (must
// NOT become a screen), and the menu step has ?tab= sub-views (off by default,
// addable per recording).
const http = require('http');

const PAGE = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Onboarding | TestDash</title>
<style>
  body { margin: 0; font: 16px/1.4 system-ui, sans-serif; color: #111; }
  header { display: flex; justify-content: space-between; padding: 12px 20px; }
  main { display: grid; grid-template-columns: 1fr 1fr; min-height: 80vh; }
  .copy { padding: 60px 40px; }
  .art { background: linear-gradient(135deg, #ffd9d2, #ffe9a8 60%, #c9f2e0); }
  h1 { font-size: 28px; }
  button.primary { background: #eb1700; color: #fff; border: 0; border-radius: 24px; padding: 12px 28px; font-size: 16px; }
  .tabs button { margin-right: 8px; }
  #modal { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: none; align-items: center; justify-content: center; }
  #modal[aria-hidden="false"] { display: flex; }
  #modal > div { background: #fff; padding: 24px; border-radius: 12px; }
  @media (max-width: 600px) {
    main { display: block; }
    .art { height: 160px; }
    .copy { padding: 20px 16px 120px; }
    .footer { position: fixed; left: 0; right: 0; bottom: 0; padding: 12px 16px; background: #fff; }
    .footer button.primary { width: 100%; }
  }
</style></head>
<body>
<header><strong>TestDash</strong><a href="#" id="help-link" data-testid="help">Help</a></header>
<main><section class="copy" id="copy"></section><section class="art"></section></main>
<div id="modal" role="dialog" aria-modal="true" aria-hidden="true"><div><h2>Need help?</h2><p>Call us.</p><button id="close-modal">Close</button></div></div>
<script>
  const mobile = /iPhone|Android/.test(navigator.userAgent);
  const STEPS = {
    welcome: { h: 'Welcome to TestDash! Let us set up your store', next: 'store', label: 'Get started' },
    store: { h: 'Confirm your store setup', next: 'menu', label: 'Continue' },
    // Desktop and phone label this button differently, so the mirrored click
    // cannot match it on the phone — the phone has to follow by URL.
    menu: { h: 'Set up your menu', next: 'choose-package', label: mobile ? 'Next' : 'Continue to packages' },
    'choose-package': { h: 'Choose a package', next: 'payment', label: 'Continue' },
    payment: { h: 'Confirm how you want to get paid', next: null, label: 'Finish' },
  };
  function params() { return new URLSearchParams(location.search); }
  function go(patch) {
    const p = params();
    for (const [k, v] of Object.entries(patch)) { if (v == null) p.delete(k); else p.set(k, v); }
    history.pushState({}, '', location.pathname + '?' + p.toString());
    render();
  }
  function render() {
    const p = params();
    const step = STEPS[p.get('step')] ? p.get('step') : 'welcome';
    const s = STEPS[step];
    const tab = p.get('tab') || 'items';
    const copy = {
      welcome: 'We will do the heavy lifting by pre-filling details we can find online. You will just review, update anything missing, and confirm before going live. Most stores finish in about ten minutes, and you can save and come back at any point.',
      store: 'Check the name, address and phone number customers will see. If anything is wrong, edit it here; changes show up in the app within a few minutes of going live.',
      menu: 'Upload a menu or pick items we found. Photos help customers decide, and clear prices avoid refunds later. You can change the menu any time from the merchant portal.',
      'choose-package': 'Pick the plan that fits your store. Every plan includes delivery by Dashers, and you can switch plans later without losing any settings or menu changes.',
      payment: 'Add the bank account where payouts should go. Payouts arrive weekly, and you can change the account later from the settings page of the merchant portal.',
    }[step];
    if (p.get('sparse')) {
      // DoorDash-sized step: a heading, one line, three bullets, a button.
      document.getElementById('copy').innerHTML = '<h1>' + s.h + '</h1><p>We will pre-fill what we found online.</p>' +
        '<ol><li>Confirm your store</li><li>Manage orders</li><li>Get paid</li></ol>' +
        (s.next ? '<div class="footer"><button class="primary">' + s.label + '</button></div>' : '');
      const btn = document.querySelector('button.primary');
      if (btn) btn.onclick = () => go({ step: s.next, tab: null });
      document.getElementById('modal').setAttribute('aria-hidden', p.get('modal') ? 'false' : 'true');
      return;
    }
    let body = '<p class="eyebrow">Step: ' + step + '</p><h1>' + s.h + '</h1><p>' + copy + ' ' + copy + '</p>' +
      '<form onsubmit="return false"><label>Store name <input name="store_name" value="And Burger Place"></label> ' +
      '<label>Phone <input name="phone" value="(555) 010-2030"></label></form>' +
      '<ol><li>Confirm your store setup and business details for customers</li><li>Set how you want to manage incoming orders every day</li><li>Confirm how you want to get paid for every order you fulfil</li></ol>';
    if (step === 'menu') {
      body += '<div class="tabs" role="tablist">' +
        ['items', 'photos', 'hours'].map((t) => '<button role="tab" data-tab="' + t + '" aria-selected="' + (t === tab) + '">' + t + '</button>').join('') +
        '</div><p id="tab-body">Tab ' + tab + ': ' + 'menu details '.repeat(tab.length * 3) + '</p>';
    }
    body += s.next ? '<div class="footer"><button class="primary">' + s.label + '</button></div>' : '';
    document.getElementById('copy').innerHTML = body;
    document.getElementById('modal').setAttribute('aria-hidden', p.get('modal') ? 'false' : 'true');
    const next = document.querySelector('button.primary');
    if (next) next.onclick = () => go({ step: s.next, tab: null });
    document.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => go({ tab: b.dataset.tab })));
  }
  document.getElementById('help-link').onclick = (e) => { e.preventDefault(); go({ modal: 'help' }); };
  document.getElementById('close-modal').onclick = () => go({ modal: null });
  addEventListener('popstate', render);
  // Like many wizards: landing without a step fills one in — right away, or
  // after the app has booted (?late=1).
  const fillStep = () => {
    if (!params().get('step')) history.replaceState({}, '', location.pathname + '?' + (params().toString() ? params().toString() + '&' : '') + 'step=welcome');
    render();
  };
  if (params().get('late')) { render(); setTimeout(fillStep, 1500); } else fillStep();
</script>
</body></html>`;


// Uber-style store: desktop opens an item as a ?mod=quickView modal on the
// store URL; the phone opens it on its own route /store/abc/item/<id>.
const STORE = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Burger Place | TestEats</title>
<style>
  body { margin: 0; font: 16px/1.4 system-ui, sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 24px; }
  .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; background: linear-gradient(135deg,#fff2d6,#e6f7ff); }
  #quick { position: fixed; inset: 0; background: rgba(0,0,0,.45); display: none; align-items: center; justify-content: center; }
  #quick[aria-hidden="false"] { display: flex; }
  #quick > div { background: #fff; padding: 24px; border-radius: 12px; width: 420px; }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
</style></head><body>
<h1 style="padding:0 24px">Burger Place</h1>
<p style="padding:0 24px">Order burgers, fries and shakes. Delivery in 20 to 30 minutes, pickup ready in 15. Every order includes napkins and sauces on request, and you can schedule orders ahead for lunch or dinner.</p>
<main class="grid" id="grid"></main>
<section id="itempage" hidden></section>
<div id="quick" role="dialog" aria-modal="true" aria-hidden="true"><div><h2 id="qt"></h2><p>Fresh, made to order, with your choice of sides and sauces.</p><button id="qclose">Close</button></div></div>
<script>
  const mobile = /iPhone|Android/.test(navigator.userAgent);
  const ITEMS = { burger: 'Classic Burger', fries: 'Crispy Fries', shake: 'Vanilla Shake', salad: 'Garden Salad', wrap: 'Chicken Wrap', soda: 'Lemon Soda' };
  document.getElementById('grid').innerHTML = Object.entries(ITEMS).map(([id, name]) =>
    '<button class="card" data-item="' + id + '"><strong>' + name + '</strong><br>Popular item with great reviews from our customers this month.</button>').join('');
  function render() {
    const p = new URLSearchParams(location.search);
    const m = location.pathname.match(/\\/item\\/([\\w-]+)$/);
    const q = document.getElementById('quick');
    q.setAttribute('aria-hidden', p.get('mod') === 'quickView' ? 'false' : 'true');
    document.getElementById('qt').textContent = ITEMS[p.get('item')] || '';
    const page = document.getElementById('itempage');
    page.hidden = !m;
    document.getElementById('grid').hidden = !!m;
    if (m) page.innerHTML = '<h2>' + ITEMS[m[1]] + '</h2><p>Fresh, made to order.</p><button id="back">Back to store</button>';
    const back = document.getElementById('back');
    if (back) back.onclick = () => { history.pushState({}, '', '/store/abc'); render(); };
  }
  document.querySelectorAll('[data-item]').forEach((b) => (b.onclick = () => {
    const id = b.dataset.item;
    history.pushState({}, '', mobile ? '/store/abc/item/' + id : '/store/abc?mod=quickView&item=' + id);
    render();
  }));
  document.getElementById('qclose').onclick = () => { history.pushState({}, '', '/store/abc'); render(); };
  addEventListener('popstate', render);
  render();
</script></body></html>`;


const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/store/abc' || u.pathname.startsWith('/store/abc/item/')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(STORE);
    return;
  }
  if (u.pathname === '/merchant/onboarding-v2') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(PAGE);
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('not found');
});

const port = Number(process.env.PORT || 4817);
server.listen(port, '127.0.0.1', () => console.log(`site on http://127.0.0.1:${port}`));
module.exports = server;
