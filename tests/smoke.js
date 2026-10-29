// Headless-Chrome smoke test for battleship-bd via raw CDP.
// Run: node tests/smoke.js [390]  (390 = mobile viewport width)
'use strict';
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const MOBILE = process.argv[2] === '390';
const PORT = 9300 + (process.pid % 500);
const HS = process.env.HOME + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
const FILE = 'file://' + path.resolve(__dirname, '..', 'index.html');

const errors = [];
let ws, nextId = 1;
const pending = new Map();
function send(method, params) {
  const id = nextId++;
  return new Promise((res) => {
    pending.set(id, { res });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
function req(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: PORT, path: urlPath, method },
      (res) => { let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
function ev(expr) {
  return send('Runtime.evaluate', { expression: expr, returnByValue: true }).then((r) => {
    if (r.exceptionDetails) throw new Error('eval failed: ' + expr + ' :: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
    return r.result.value;
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(cond, label, timeout) {
  timeout = timeout || 8000;
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await cond()) return; await sleep(150); }
  throw new Error('timeout waiting for: ' + label);
}
let checks = 0;
function check(name, ok, extra) {
  checks++;
  if (!ok) throw new Error('CHECK FAILED: ' + name + (extra !== undefined ? ' :: ' + extra : ''));
  console.log('ok ' + checks + ' - ' + name);
}

async function main() {
  const prof = '/tmp/bb-smoke-' + process.pid;
  const chrome = spawn(HS, ['--headless=new', '--no-sandbox', '--disable-gpu',
    '--window-size=' + (MOBILE ? '390,844' : '1280,900'),
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof, 'about:blank'],
    { stdio: 'ignore', detached: false });
  try {
    await waitFor(async () => (await req('GET', '/json/version').catch(() => ({ status: 0 }))).status === 200, 'debug port', 20000);
    const created = await req('PUT', '/json/new?' + encodeURIComponent(FILE));
    if (created.status !== 200) throw new Error('/json/new PUT status ' + created.status);
    const target = JSON.parse(created.body);
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); p.res(d.result); }
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') errors.push('console.error');
      if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(d.exceptionDetails).slice(0, 200));
    };
    await send('Page.enable', {}); await send('Runtime.enable', {});
    if (MOBILE) {
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    }
    await send('Page.navigate', { url: FILE });
    await waitFor(async () => (await ev('document.readyState')) === 'complete', 'page load');
    await sleep(500);

    check('title is Battleship BD', (await ev('document.title')) === 'Battleship BD');
    check('200 board cells render (2 x 10x10)', (await ev('document.querySelectorAll(".cell").length')) === 200);
    check('5 ship picker buttons', (await ev('document.querySelectorAll(".ship-pick").length')) === 5);
    check('placement panel visible', (await ev('document.getElementById("placePanel").style.display')) !== 'none');

    // Random placement -> all 5 ships placed
    await ev('document.getElementById("randomBtn").click()');
    await sleep(200);
    check('random placement marks all 5 ships placed',
      (await ev('document.querySelectorAll(".ship-pick.placed").length')) === 5);
    check('player board shows 17 ship cells',
      (await ev('document.querySelectorAll("#playerGrid .cell.ship").length')) === 17);

    // Start battle
    await ev('document.getElementById("startBtn").click()');
    await sleep(200);
    check('battle starts: status shows your turn',
      (await ev('document.getElementById("status").textContent')).includes('Your turn'));
    check('enemy grid active in battle',
      (await ev('document.getElementById("enemyGrid").className')).includes('active'));

    // Fire one shot at enemy cell (0,0); it must resolve to hit or miss.
    await ev('document.querySelector("#enemyGrid .cell").click()');
    await sleep(300);
    const cls = await ev('document.querySelector("#enemyGrid .cell").className');
    check('fired enemy cell resolves to hit or miss', cls.includes('hit') || cls.includes('miss'), cls);

    // Computer replies within ~2s: some player cell must gain hit/miss.
    await waitFor(async () =>
      (await ev('document.querySelectorAll("#playerGrid .cell.hit, #playerGrid .cell.miss").length')) >= 1,
      'computer return fire', 5000);
    check('computer return fire marked on player board', true);
    check('status back to your turn',
      (await ev('document.getElementById("status").textContent')).includes('Your turn'));

    // Language toggle -> Bengali title renders (real Bengali chars in DOM)
    await ev('document.getElementById("langBtn").click()');
    await sleep(200);
    const bnTitle = await ev('document.getElementById("title").textContent');
    check('BN toggle renders Bengali title', /[\u0980-\u09FF]/.test(bnTitle), bnTitle);
    check('BN toggle persists', (await ev('localStorage.getItem("battleship-lang")')) === 'bn');

    // Stats persist a finished-shot count (read from localStorage: BN digits break Number())
    const saved = JSON.parse(await ev('localStorage.getItem("battleship-stats")'));
    check('career shots stat >= 1', saved.shots >= 1, JSON.stringify(saved));

    if (MOBILE) {
      const overflow = await ev('document.documentElement.scrollWidth > document.documentElement.clientWidth');
      check('390px: no horizontal overflow', !overflow);
    }
    check('zero console/page errors', errors.length === 0, errors.join(' | '));
    console.log('\n' + checks + '/' + checks + ' smoke checks passed' + (MOBILE ? ' (mobile)' : ' (desktop)'));
  } finally {
    try { ws && ws.close(); } catch (e) {}
    chrome.kill();
  }
}
main().catch((e) => { console.error('SMOKE FAILED: ' + e.message); process.exit(1); });
