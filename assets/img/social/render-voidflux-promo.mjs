// Renders assets/img/social/voidflux-promo.png from the #voidflux board of
// facebook-social.html. Node only, no packages:
//
//   node assets/img/social/render-voidflux-promo.mjs
//
// The two cream boards in that file are stills and Chrome's own --screenshot
// renders them straight off disk. This board is the site's live banner, and it
// needs three things that flag cannot give it:
//
//   - an http origin, because voidflux-banner.js is an ES module, so the script
//     serves the repo root itself on a loopback port (nothing in the banner's
//     scripts is Liquid, so there is no Jekyll build to wait for);
//   - real wall-clock time, because --screenshot only holds the page open under
//     --virtual-time-budget, and under virtual time the IntersectionObserver
//     that lazily imports voidflux-scene.js never fires, which silently yields
//     the 2D grid with no loops and no gems;
//   - forced reduced motion, which parks the scene at voidflux-scene.js's
//     STILL_TIME instead of letting the shot catch the animation anywhere.
//
// With that and the scene's fixed mulberry32 seeds the render is deterministic:
// two runs give byte-identical PNGs.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../..');
const OUT = join(HERE, 'voidflux-promo.png');
const PAGE = '/assets/img/social/facebook-social.html#voidflux';
const SIZE = 1200;
// Long enough for SwiftShader to compile the gem and glow shaders on a cold
// start; the run stops as soon as the banner reports itself ready.
const READY_TIMEOUT_MS = 60_000;
// The gem mesh is fetched after mount and re-poses the scene when it lands.
const SETTLE_MS = 3_000;

const CHROME = process.env.CHROME
  ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cleanups = [];

async function serveRoot() {
  // Port 0 lets the kernel pick, so concurrent runs never collide; the chosen
  // port comes back only in the server's own banner line on stdout.
  const server = spawn('python3', ['-u', '-m', 'http.server', '0', '--bind', '127.0.0.1'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  cleanups.push(() => server.kill());
  const port = await new Promise((res, rej) => {
    const timer = setTimeout(() => rej(new Error('static server never reported a port')), 10_000);
    server.stdout.on('data', (chunk) => {
      const m = /port (\d+)/.exec(String(chunk));
      if (m) { clearTimeout(timer); res(Number(m[1])); }
    });
  });
  return `http://127.0.0.1:${port}`;
}

async function openBrowser() {
  const profile = mkdtempSync(join(tmpdir(), 'voidflux-promo-'));
  const port = 9500 + (process.pid % 400);
  const chrome = spawn(CHROME, [
    '--headless',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--hide-scrollbars',
    // Parks the scene at STILL_TIME rather than mid-animation.
    '--force-prefers-reduced-motion',
    // Headless has no GPU, and without software WebGL the scene half is absent.
    '--enable-unsafe-swiftshader',
    '--use-angle=swiftshader',
    `--window-size=${SIZE},${SIZE}`,
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
  cleanups.push(() => { chrome.kill(); rmSync(profile, { recursive: true, force: true }); });

  for (let i = 0; ; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return connect(page.webSocketDebuggerUrl);
    } catch { /* devtools is not listening yet */ }
    if (i > 200) throw new Error('chrome devtools endpoint never came up');
    await sleep(100);
  }
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  cleanups.push(() => ws.close());

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id === undefined) return;
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
  };
  return (method, params = {}) => new Promise((resolve_, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: resolve_, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

let failure = null;
try {
  const origin = await serveRoot();
  const send = await openBrowser();

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: SIZE, height: SIZE, deviceScaleFactor: 1, mobile: false,
  });
  await send('Page.navigate', { url: origin + PAGE });

  const deadline = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    await sleep(250);
    const { result } = await send('Runtime.evaluate', {
      expression: "!!document.querySelector('[data-vf-banner][data-vf-ready]')",
      returnByValue: true,
    });
    ready = result.value === true;
  }
  // Grid-only is a legitimate runtime fallback on the site but a failed render
  // here, so it is an error rather than something to ship.
  if (!ready) throw new Error('the scene never mounted: the render would be grid-only');

  await sleep(SETTLE_MS);
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(OUT, Buffer.from(shot.data, 'base64'));
  console.log(`wrote ${OUT}`);
} catch (err) {
  failure = err;
} finally {
  for (const stop of cleanups.reverse()) {
    try { stop(); } catch { /* already gone */ }
  }
  await sleep(300);
  if (failure) console.error(failure);
  process.exit(failure ? 1 : 0);
}
