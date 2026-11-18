// Self-check for the hero's PC algorithm with the oracle test. Run: node tests/pc.test.js
// Oracle PC must recover the true skeleton exactly, never draw a wrong arrow, and orient every true collider.
const assert = require('assert');
const { makeConnectedDAG, dsepOracle, closeness, runPC } = require('../assets/pc.js');

const connectedDAG = p => makeConnectedDAG(p, 2); // the hero's generator

let graphs = 0, worst50 = 0;
for (const p of [3, 4, 5, 8, 15, 30, 50]) for (let r = 0; r < (p >= 30 ? 30 : 200); r++) {
  const d = connectedDAG(p), t0 = Date.now(), R = runPC(dsepOracle(d), p, Infinity, closeness(d)), ms = Date.now() - t0;
  if (p === 50) worst50 = Math.max(worst50, ms);
  const par = d.pa.map(ps => new Set(ps.map(e => e.j))), edge = (a, b) => par[a].has(b) || par[b].has(a);
  for (let a = 0; a < p; a++) for (let b = a + 1; b < p; b++) assert.strictEqual(R.adj[a].has(b), edge(a, b), `skeleton mismatch ${a}-${b} (p=${p})`);
  for (const k of R.dir) { const [a, b] = k.split('>').map(Number); assert(par[b].has(a), `wrong arrow ${a}->${b} (p=${p})`); }
  for (let c = 0; c < p; c++) { const ps = [...par[c]]; for (const a of ps) for (const b of ps) if (a < b && !edge(a, b)) assert(R.dir.has(a + '>' + c) && R.dir.has(b + '>' + c), `collider ${a}->${c}<-${b} not oriented (p=${p})`); }
  graphs++;
}
// test budget: a run that would need more than maxTests tests gives up (returns null) instead of freezing the page
{
  const d = connectedDAG(30), full = runPC(dsepOracle(d), 30, Infinity, closeness(d));
  const nTests = full.events.filter(e => e.t === 'test').length;
  assert.strictEqual(runPC(dsepOracle(d), 30, Infinity, closeness(d), nTests - 1), null, 'over-budget run should return null');
  assert.notStrictEqual(runPC(dsepOracle(d), 30, Infinity, closeness(d), nTests), null, 'run exactly at budget should complete');
  // with the hero's budget, no 50-variable run does more than 60000 tests (bounded work; wall-clock time depends on the machine)
  for (let r = 0; r < 300; r++) {
    const g = connectedDAG(50), ind = dsepOracle(g); let n = 0;
    runPC((i, j, S) => (n++, ind(i, j, S)), 50, Infinity, closeness(g), 60000);
    assert(n <= 60000, `budgeted run did ${n} tests`);
  }
}
console.log(`ok: ${graphs} graphs, slowest 50-variable run ${worst50} ms`);
