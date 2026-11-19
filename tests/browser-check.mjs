// Real-browser checks of the built site (run tests/build-check.sh first). Usage: node tests/browser-check.mjs
// Serves /tmp/site-build, drives headless Chrome over the DevTools protocol, waits real time.
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const SITE = '/tmp/site-build', HTTP = 47391, CDP = 47392, URL = `http://127.0.0.1:${HTTP}/`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const server = spawn('python3', ['-m', 'http.server', String(HTTP), '-d', SITE, '--bind', '127.0.0.1'], { stdio: 'ignore' });
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ['--headless=new', `--remote-debugging-port=${CDP}`, `--user-data-dir=/tmp/site-check-profile-${process.pid}`, 'about:blank'], { stdio: 'ignore' });
const done = code => { chrome.kill(); server.kill(); process.exit(code); };

try {
  let ours = false; // wait for our server, and make sure the port isn't someone else's
  for (let i = 0; i < 50 && !ours; i++) { try { ours = (await (await fetch(URL)).text()).includes('Rickard Karlsson'); } catch {} if (!ours) await sleep(100); }
  assert(ours, `port ${HTTP} is not serving ${SITE}`);
  let target;
  for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${CDP}/json`)).json()).find(t => t.type === 'page'); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pending = new Map(), errors = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); if (pending.has(d.id)) { pending.get(d.id)(d.result); pending.delete(d.id); } };
  const send = (method, params = {}) => new Promise(r => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
  const ev = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result.value;
  const open = async (w, h, path = '') => { await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 }); await send('Page.navigate', { url: URL + path }); await sleep(1500); };
  await send('Runtime.enable');

  // hero runs: tests counter moves, canvas has size, slider restarts at 50
  await open(1100, 860);
  const testsNow = async () => +(await ev("document.getElementById('tests').textContent.replace(/,/g, '')"));
  for (let i = 0; i < 65 && !(await testsNow() > 0); i++) await sleep(100); // the first run comes from the worker; slower under load
  assert(await testsNow() > 0, 'tests counter did not move');
  assert(await ev("document.getElementById('c').width") > 0, 'canvas has no width');
  assert(await ev('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow at 1100px');
  // placed by layout, not a transform: a -50% translate lands on half pixels and blurs the 1px frame and the graph
  assert.strictEqual(await ev("getComputedStyle(document.querySelector('.first')).translate"), 'none', 'first screen is shifted with translate');
  await ev("const n = document.getElementById('nodes'); n.value = 50; n.dispatchEvent(new Event('input')); n.dispatchEvent(new Event('change')); 1");
  await sleep(1500);
  assert.strictEqual(await ev("document.getElementById('nodesv').textContent"), '50');
  // restarting at 50 variables never freezes the page
  const slowest = await ev("(() => { const n = document.getElementById('nodes'); n.value = 50; let worst = 0; for (let k = 0; k < 30; k++) { const t = performance.now(); n.dispatchEvent(new Event('change')); worst = Math.max(worst, performance.now() - t); } return worst; })()");
  assert(slowest < 500, `restart at 50 variables blocked the page for ${Math.round(slowest)} ms`);
  await sleep(2500); // the latest of those restarts arrives from the worker and runs
  assert(+(await ev("document.getElementById('tests').textContent.replace(/,/g, '')")) > 0, 'no run after restarting at 50');
  // the animation pauses while scrolled out of view
  await ev('scrollTo(0, document.body.scrollHeight)'); await sleep(500);
  const t1 = await ev("document.getElementById('tests').textContent"); await sleep(1000);
  assert.strictEqual(await ev("document.getElementById('tests').textContent"), t1, 'animation kept running off screen');
  // every size, one load each:
  // - the first screen fits: the arrow sits inside the window (widest counter, so the controls row can't wrap later)
  // - the graph only grows past the text column while the screen is tall enough to keep it at 8:5
  // - the name and the research link line up with the box's left and right edges
  // - on a wide screen, name to caption sits centred above the arrow
  for (const [w, h] of [[1366, 657], [1280, 600], [375, 553], [1280, 720], [1366, 768], [1440, 900], [2560, 1440]]) {
    await open(w, h);
    const m = await ev(`(() => { document.getElementById('tests').textContent = '60,000';
      const r = s => document.querySelector(s).getBoundingClientRect(), f = r('.field'), c = r('#c');
      const d = r('#down'), n = r('header .name');
      return { arrowTop: d.top, arrowBottom: d.bottom, nameLeft: n.left, nameTop: n.top, nav: r('header nav').right, cap: r('.caption').bottom, f: [f.left, f.right, f.width], c: [c.width, c.height] }; })()`);
    assert(m.arrowBottom <= h, `arrow below the fold at ${w}x${h} (bottom ${Math.round(m.arrowBottom)}px)`);
    if (w < 600) continue;
    assert(m.c[0] <= 717 || m.c[0] / m.c[1] <= 1.62, `graph squashed at ${w}x${h}: ${m.c.map(Math.round)}`);
    assert(Math.abs(m.nameLeft - m.f[0]) <= 1 && Math.abs(m.nav - m.f[1]) <= 1, `header not aligned with the box at ${w}x${h}`);
    if (w === 2560) {
      assert(Math.abs(m.nameTop - (m.arrowTop - m.cap)) < 40, `first screen not centred: ${JSON.stringify(m)}`);
      assert(m.f[2] > 760 && m.f[2] <= 1080, `hero width ${m.f[2]}`);
    }
  }
  // the research page keeps its header on the text column
  await open(2560, 1440, 'research.html');
  assert(await ev("Math.abs(document.querySelector('header').getBoundingClientRect().width - document.querySelector('main').getBoundingClientRect().width) <= 1"), 'research header width changed');
  // phone width: nothing sticks out sideways
  await open(375, 740);
  assert(await ev('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow at 375px');

  // below the hero: hidden until scrolled into view; the arrow appears, scrolls down, then goes away
  const shown = () => ev("JSON.stringify([...document.querySelectorAll('.reveal')].map(e => e.classList.contains('on')))");
  const opacity = () => ev("+getComputedStyle(document.querySelector('.reveal')).opacity");
  await open(1100, 860);
  assert(!(await shown()).includes('true'), 'sections visible before scrolling');
  await sleep(2000);
  assert(await ev("document.getElementById('down').classList.contains('on')"), 'arrow did not appear');
  await ev('scrollTo(0, innerHeight * .6)'); await sleep(800);
  assert(JSON.parse(await shown())[0], 'first section not revealed after a partial scroll');
  assert(await ev("document.getElementById('down').classList.contains('away')"), 'arrow did not go away');
  await ev('scrollTo(0, document.body.scrollHeight)'); await sleep(800);
  assert(!(await shown()).includes('false'), 'sections not all revealed after scrolling down');
  await ev("scrollTo(0, 0); document.getElementById('down').classList.remove('away'); 1"); await sleep(300);
  await ev("document.getElementById('down').click(); 1"); await sleep(1500);
  // the arrow brings the About block to the top of the window, its content centred in that screen
  const ab = await ev(`(() => { const r = s => document.querySelector(s).getBoundingClientRect();
    return { t: r('.about').top, i: r('.intro').top, l: r('.about > :last-child').bottom, prev: r('.prev').bottom, sig: r('.signoff').top, h: innerHeight }; })()`);
  // the signature follows right under Previously, inside the centred block, not at the bottom of the page
  assert(ab.sig - ab.prev <= 80 && ab.sig - ab.prev >= 0, `signature not under the content: ${JSON.stringify(ab)}`);
  assert(Math.abs(ab.t) <= 2, `About block top at ${ab.t}px after arrow click`);
  assert(Math.abs(ab.i - (ab.h - ab.l)) < 60, `About content not centred: ${JSON.stringify(ab)}`);
  // the sign-off waits 7.5 s after it comes into view, then writes "with love, rickard"
  await open(1100, 860); // fresh page, so the timer starts with this scroll
  await ev('scrollTo(0, document.body.scrollHeight)'); await sleep(5000);
  assert(!(await ev("!!document.querySelector('#sig svg path')")), 'sign-off started before 7.5 s');
  await sleep(4500);
  assert.strictEqual(await ev("document.querySelector('#sig svg [data-text]')?.getAttribute('data-text')"), 'with love, Rickard', 'sign-off text');
  const sigBox = await ev("JSON.stringify(document.getElementById('sig').getBoundingClientRect())");
  assert(JSON.parse(sigBox).height <= 60, `sign-off too tall: ${sigBox}`);
  // without JavaScript the text is still readable
  await send('Emulation.setScriptExecutionDisabled', { value: true });
  await open(1100, 860);
  assert.strictEqual(await opacity(), 1, 'text hidden when JS is off');
  await send('Emulation.setScriptExecutionDisabled', { value: false });
  // reduced motion: visible straight away
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await open(1100, 860);
  assert.strictEqual(await opacity(), 1, 'text hidden under reduced motion');
  await send('Emulation.setEmulatedMedia', { features: [] });

  assert.deepStrictEqual(errors, [], 'page threw: ' + errors.join(' | '));
  console.log('BROWSER OK');
  done(0);
} catch (e) { console.log('FAIL:', e.message); done(1); }
