// Home page hero: the PC algorithm (assets/pc.js) running live on a random causal graph.
const DEG = 2, MAX_TESTS = 60000;
let onScreen = true;
const cv = document.getElementById('c'), ctx = cv.getContext('2d'), nodesEl = document.getElementById('nodes');
let acc = 0, P, dag, pos, nodes, clock = 0, ev, ei, perFrame, E, phase, hold, darken, curTest, mouse = null;

function layout(dag) { // force-directed on the true skeleton so the final picture reads cleanly
  const p = dag.p, pts = [...Array(p)].map(() => ({ x: Math.random(), y: Math.random(), vx: 0, vy: 0 })), k = .9 / Math.sqrt(p), links = [];
  dag.pa.forEach((ps, i) => ps.forEach(({ j }) => links.push([i, j])));
  for (let it = 0, T = .1; it < 500; it++, T *= .992) {
    for (const q of pts) { q.vx = 0; q.vy = 0; }
    for (let a = 0; a < p; a++) for (let b = a + 1; b < p; b++) { const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, d = Math.max(.01, Math.hypot(dx, dy)), f = k * k / d / d; pts[a].vx += dx * f; pts[a].vy += dy * f; pts[b].vx -= dx * f; pts[b].vy -= dy * f; }
    for (const [a, b] of links) { const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y, f = Math.hypot(dx, dy) / k; pts[a].vx -= dx * f; pts[a].vy -= dy * f; pts[b].vx += dx * f; pts[b].vy += dy * f; }
    for (const q of pts) { q.vx += (.5 - q.x) * .5; q.vy += (.5 - q.y) * .5; const v = Math.hypot(q.vx, q.vy); if (v > T) { q.vx *= T / v; q.vy *= T / v; } q.x += q.vx; q.y += q.vy; }
  }
  const xs = pts.map(q => q.x), ys = pts.map(q => q.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return pts.map(q => ({ x: (q.x - x0) / (x1 - x0 || 1), y: (q.y - y0) / (y1 - y0 || 1) }));
}
const key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
// runs are computed in a worker so restarting never blocks the page; only the latest request is used
const worker = new Worker('/assets/pc-worker.js');
let req = 0;
function start() { phase = 'waiting'; worker.postMessage({ id: ++req, P: +nodesEl.value, deg: DEG, maxTests: MAX_TESTS }); }
worker.onmessage = ({ data }) => {
  if (data.id !== req) return;
  P = data.P; dag = data.dag; pos = layout(dag);
  // each node: a slow drift (phase, speed) plus a spring-damped displacement that the cursor can push
  nodes = pos.map(() => ({ p1: Math.random() * 7, p2: Math.random() * 7, f1: .004 + .004 * Math.random(), f2: .004 + .004 * Math.random(), dx: 0, dy: 0, vx: 0, vy: 0 }));
  ev = data.events; ei = 0;
  const nTests = ev.filter(e => e.t === 'test').length; perFrame = nTests / ((6 + P / 6) * 60); acc = 0; // fractional: small graphs step slowly, bigger ones take a bit longer
  E = new Map(); for (let a = 0; a < P; a++) for (let b = a + 1; b < P; b++) E.set(key(a, b), { a, b, alpha: 1, gone: false, arrow: null, grow: 0 });
  phase = 'skeleton'; hold = 0; darken = 0; curTest = null; tick.tests = 0;
};
function tick() {
  if (phase === 'waiting') return; // keep showing the previous graph until the next run arrives
  if (phase === 'skeleton') {
    acc += perFrame;
    for (; acc >= 1 && ei < ev.length && ev[ei].t === 'test'; acc--, ei++) { const e = ev[ei]; curTest = e; tick.tests++; if (e.removed) E.get(key(e.i, e.j)).gone = true; }
    if (ei >= ev.length || ev[ei].t !== 'test') { phase = 'darken'; curTest = null; }
  } else if (phase === 'darken') { if ((darken += .025) >= 1) { darken = 1; phase = 'orient'; } }
  else if (phase === 'orient') { if ((hold++ % 3) === 0) { if (ei < ev.length) { const e = ev[ei++]; E.get(key(e.a, e.b)).arrow = [e.a, e.b]; } else { phase = 'hold'; hold = 0; } } }
  else if (phase === 'hold') { if (++hold > 60 * 8) start(); } // rest on the finished graph, then loop with a new one
  for (const ed of E.values()) { if (ed.gone) ed.alpha = Math.max(0, ed.alpha - .05); if (ed.arrow) ed.grow = Math.min(1, ed.grow + .1); }
}
function physics(hx, hy) { // spring back towards the drifting home position, pushed away by a nearby cursor
  const R = 110;
  nodes.forEach((n, i) => {
    let fx = (7 * Math.sin(clock * n.f1 + n.p1) - n.dx) * .02, fy = (7 * Math.cos(clock * n.f2 + n.p2) - n.dy) * .02;
    if (mouse) { const x = hx(i) + n.dx - mouse.x, y = hy(i) + n.dy - mouse.y, d = Math.hypot(x, y); if (d < R && d > .01) { const s = 2.4 * (1 - d / R) ** 2; fx += x / d * s; fy += y / d * s; } }
    n.vx = (n.vx + fx) * .88; n.vy = (n.vy + fy) * .88; n.dx += n.vx; n.dy += n.vy;
  });
}
function resize() { const q = devicePixelRatio || 1, r = cv.getBoundingClientRect(); cv.width = r.width * q; cv.height = r.height * q; ctx.setTransform(q, 0, 0, q, 0, 0); }
function head(x1, y1, x2, y2, g, col) {
  const a = Math.atan2(y2 - y1, x2 - x1), ex = x2 - Math.cos(a) * 5, ey = y2 - Math.sin(a) * 5, s = 9 * g;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - s * Math.cos(a - .42), ey - s * Math.sin(a - .42)); ctx.lineTo(ex - s * Math.cos(a + .42), ey - s * Math.sin(a + .42)); ctx.fill();
}
function frame() {
  if (!onScreen || !E) { requestAnimationFrame(frame); return; } // paused while scrolled out of view, or before the first run
  tick(); clock++;
  const r = cv.getBoundingClientRect(), W = r.width, H = r.height, m = Math.min(W, H) * .08;
  const hx = i => m + pos[i].x * (W - 2 * m), hy = i => m + pos[i].y * (H - 2 * m);
  physics(hx, hy);
  const X = i => hx(i) + nodes[i].dx, Y = i => hy(i) + nodes[i].dy;
  const line = (a, b) => { ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke(); };
  ctx.clearRect(0, 0, W, H);
  const base = Math.min(.3, 6 / P); // faint web: darker for small graphs, lighter when there are many more edges
  for (const ed of E.values()) {
    if (ed.alpha <= 0) continue;
    const a = ed.gone ? ed.alpha * base : base + (1 - base) * darken;
    ctx.strokeStyle = `rgba(0,0,0,${a})`; ctx.lineWidth = ed.gone ? .7 : .7 + .7 * darken; line(ed.a, ed.b);
    if (ed.arrow) head(X(ed.arrow[0]), Y(ed.arrow[0]), X(ed.arrow[1]), Y(ed.arrow[1]), ed.grow, `rgba(0,0,0,${a})`);
  }
  if (curTest) { ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2; line(curTest.i, curTest.j); }
  ctx.fillStyle = '#000';
  for (let i = 0; i < P; i++) { ctx.beginPath(); ctx.arc(X(i), Y(i), curTest && (curTest.i === i || curTest.j === i) ? 3.8 : 2.8, 0, 7); ctx.fill(); }
  document.getElementById('tests').textContent = tick.tests.toLocaleString();
  requestAnimationFrame(frame);
}
const setMouse = (x, y) => { const r = cv.getBoundingClientRect(); mouse = { x: x - r.left, y: y - r.top }; };
cv.addEventListener('pointermove', e => setMouse(e.clientX, e.clientY));
cv.addEventListener('pointerleave', () => { mouse = null; });
nodesEl.addEventListener('input', () => { document.getElementById('nodesv').textContent = nodesEl.value; });
nodesEl.addEventListener('change', start);
addEventListener('resize', resize);
new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; }).observe(cv);
resize(); start();
frame();
