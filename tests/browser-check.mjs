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
  // the first screen fits: the arrow sits inside the window on short laptop and phone screens
  for (const [w, h] of [[1366, 657], [1280, 600], [375, 553]]) {
    await open(w, h);
    const bottom = await ev("document.getElementById('tests').textContent = '60,000'; document.getElementById('down').getBoundingClientRect().bottom"); // widest counter, so the controls row can't wrap later
    assert(bottom <= h, `arrow below the fold at ${w}x${h} (bottom ${Math.round(bottom)}px)`);
  }
  // wide screen: the hero (controls to caption) sits centred above the arrow and grows past the 760px text column
  await open(2560, 1440);
  const g = JSON.parse(await ev("JSON.stringify({c: document.querySelector('.controls').getBoundingClientRect().top, h: document.querySelector('.hero').getBoundingClientRect().top, cap: document.querySelector('.caption').getBoundingClientRect().bottom, a: document.getElementById('down').getBoundingClientRect().top, w: document.querySelector('.field').getBoundingClientRect().width})"));
  assert(Math.abs((g.c - g.h) - (g.a - g.cap)) < 40, `hero not centred: ${JSON.stringify(g)}`);
  assert(g.w > 760 && g.w <= 1080, `hero width ${g.w}`);
  await open(1100, 860);
  assert(await ev('document.documentElement.scrollWidth <= innerWidth'), 'horizontal overflow at 1100px');
  // placed by layout, not a transform: a -50% translate lands on half pixels and blurs the 1px frame and the graph
  assert.strictEqual(await ev("getComputedStyle(document.querySelector('.hero')).translate"), 'none', 'hero is shifted with translate');
  // the hero only grows past the text column while the screen is tall enough to keep the graph at 8:5
  for (const [w, h] of [[1280, 720], [1366, 768], [1280, 600], [1440, 900], [2560, 1440]]) {
    await open(w, h);
    const f = JSON.parse(await ev("JSON.stringify(document.getElementById('c').getBoundingClientRect())"));
    assert(f.width <= 717 || f.width / f.height <= 1.62, `graph squashed at ${w}x${h}: ${Math.round(f.width)}x${Math.round(f.height)}`);
    // the name and the research link line up with the box's left and right edges
    const e = JSON.parse(await ev("JSON.stringify([document.querySelector('header .name').getBoundingClientRect().left, document.querySelector('header nav').getBoundingClientRect().right, document.querySelector('.field').getBoundingClientRect().left, document.querySelector('.field').getBoundingClientRect().right])"));
    assert(Math.abs(e[0] - e[2]) <= 1 && Math.abs(e[1] - e[3]) <= 1, `header not aligned with the box at ${w}x${h}: ${e.map(Math.round)}`);
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
  const ab = JSON.parse(await ev("JSON.stringify({t: document.querySelector('.about').getBoundingClientRect().top, i: document.querySelector('.intro').getBoundingClientRect().top, l: document.querySelector('.about section:last-child').getBoundingClientRect().bottom, h: innerHeight})"));
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
