'use strict';
// Local stand-in for tryprofound.com: a marketing page that never goes still.
// The hero word cycles with a blur every 1.2 s, a cookie dialog opens after
// load, tracking params are stripped with replaceState, and a product demo
// panel keeps ticking. Pages: / (home) and /pricing.
const http = require('http');

const PORT = Number(process.env.PROFOUND_PORT || 4821);

function page(title, heading, body) {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { margin: 0; font: 16px/1.5 system-ui, sans-serif; background: #0b0b0d; color: #eee; }
  header { display: flex; justify-content: space-between; align-items: center; padding: 14px 32px; border-bottom: 1px solid #222; }
  header a { color: #fff; }
  .hero { text-align: center; padding: 80px 24px 40px; }
  h1 { font-size: 44px; margin: 0 0 12px; }
  #word { display: inline-block; transition: filter .4s, opacity .4s; }
  #word.blur { filter: blur(8px); opacity: .2; }
  .lead { max-width: 640px; margin: 0 auto; color: #aaa; }
  .demo { margin: 40px auto; max-width: 900px; border: 1px solid #222; border-radius: 12px; padding: 24px; display: grid; grid-template-columns: 220px 1fr; gap: 24px; }
  .demo ul { margin: 0; padding: 0; list-style: none; }
  .demo li { padding: 6px 0; color: #bbb; }
  #ticker { font-family: ui-monospace, monospace; color: #8f8; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; margin: 0 auto 80px; }
  .cards div { border: 1px solid #222; border-radius: 10px; padding: 16px; color: #bbb; }
  #cookies { position: fixed; right: 24px; bottom: 24px; width: 360px; background: #151518; border: 1px solid #333; border-radius: 12px; padding: 20px; display: none; }
  #cookies.on { display: block; }
  #cookies button { margin: 6px 6px 0 0; padding: 8px 14px; border-radius: 8px; border: 0; }
  @media (max-width: 600px) {
    h1 { font-size: 30px; }
    .demo, .cards { grid-template-columns: 1fr; margin-left: 16px; margin-right: 16px; }
    #cookies { left: 12px; right: 12px; width: auto; }
  }
</style></head>
<body>
<header><strong>Profoundish</strong><nav><a href="/pricing" id="to-pricing">Pricing</a></nav></header>
<section class="hero">
  <h1>${heading} <span id="word">ChatGPT</span></h1>
  <p class="lead">${body}</p>
</section>
<section class="demo">
  <ul><li>AI Marketer</li><li>Projects</li><li>Context Manager</li><li>Agents</li><li>Sheets</li><li>Documents</li></ul>
  <div><div id="typing"></div><div id="ticker">0 prompts tracked</div></div>
</section>
<section class="cards">
  <div>Answer engine insights across every assistant your buyers use, refreshed every day with fresh prompts and citations.</div>
  <div>Agent analytics: see which crawlers read your pages, how often they come back, and which answers they cite.</div>
  <div>Content that ranks in AI answers, written with the context only your teams have and checked against what agents cite.</div>
</section>
<div id="cookies" role="dialog" aria-label="Cookie preferences">
  <strong>Cookie preferences</strong>
  <p>We use cookies to improve the site. You can opt out of certain cookies.</p>
  <button id="accept">Accept all</button><button id="reject">Reject all</button>
</div>
<script>
  const words = ['ChatGPT', 'Microsoft Copilot', 'Perplexity', 'Gemini', 'Claude', 'Google AI Mode'];
  let i = 0;
  setInterval(() => {
    const w = document.getElementById('word');
    w.classList.add('blur');
    setTimeout(() => { i = (i + 1) % words.length; w.textContent = words[i]; w.classList.remove('blur'); }, 400);
  }, 1200);
  let n = 0;
  setInterval(() => { n += 7; document.getElementById('ticker').textContent = n + ' prompts tracked'; }, 300);
  setTimeout(() => document.getElementById('cookies').classList.add('on'), 900);
  // Live demo: a prompt types itself out, letter by letter, forever.
  const prompt = 'Find an opportunity to improve content for it.';
  let k = 0;
  setInterval(() => {
    const box = document.getElementById('typing');
    k = (k + 1) % (prompt.length + 12);
    box.replaceChildren(...[...prompt.slice(0, Math.min(k, prompt.length))].map((c) => { const s = document.createElement('span'); s.textContent = c; return s; }));
  }, 70);
  // Phone build whose tag manager keeps reloading it (?phoneloop=1): the
  // phone never holds a page long enough for its capture to finish.
  if (new URLSearchParams(location.search).has('phoneloop')) sessionStorage.setItem('phoneloop', '1');
  if (/iPhone|Android/.test(navigator.userAgent) && sessionStorage.getItem('phoneloop') && location.pathname === '/') {
    setTimeout(() => location.reload(), 1200);
  }
  // Consent / A-B tool: reloads the page once, a couple of seconds in (?reload=1).
  if (new URLSearchParams(location.search).has('reload') && !sessionStorage.getItem('reloaded')) {
    setTimeout(() => { sessionStorage.setItem('reloaded', '1'); location.replace(location.href); }, 2200);
  }
  document.getElementById('accept').onclick = () => document.getElementById('cookies').classList.remove('on');
  document.getElementById('reject').onclick = () => document.getElementById('cookies').classList.remove('on');
  // Analytics strips its landing params once it has read them.
  setTimeout(() => {
    const u = new URL(location.href);
    if (u.searchParams.has('vector_id')) {
      u.searchParams.delete('vector_id');
      u.searchParams.delete('vector_source');
      u.searchParams.delete('reload');
      u.searchParams.delete('phoneloop');
      history.replaceState({}, '', u.pathname + (u.search || ''));
    }
  }, 1500);
</script>
</body></html>`;
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  res.setHeader('content-type', 'text/html; charset=utf-8');
  if (u.pathname === '/pricing') {
    res.end(page('Pricing | Profoundish', 'Plans that win in', 'Simple pricing for teams that want to show up in every AI answer. Start small and grow with seats, prompts and agents as you need them.'));
    return;
  }
  res.end(
    page(
      'Profoundish | The AI Platform to Power Your Brand',
      'The AI marketing platform to win in',
      'Multiply what you can accomplish with an AI Marketer trained on what consumers prompt, what agents cite, and the context only your teams have.'
    )
  );
});
server.listen(PORT, '127.0.0.1');
module.exports = server;
module.exports.PORT = PORT;
