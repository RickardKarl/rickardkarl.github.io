// PC algorithm (Spirtes & Glymour 1991) with an oracle independence test (d-separation) on a random DAG. Classic script: globals in the browser, module.exports in Node.
// Exposes: makeDAG(p, deg), makeConnectedDAG(p, deg), dsepOracle(dag), closeness(dag), runPC(indep, p, maxDepth, order, maxTests) -> { events, adj, dir, sepset } | null

// random DAG in topological order 0..p-1; parents j<i, expected degree ~deg
function makeDAG(p, deg) {
  const pa = [...Array(p)].map(() => []), q = deg / (p - 1);
  for (let i = 1; i < p; i++) for (let j = 0; j < i; j++) if (Math.random() < q) pa[i].push({ j, w: (Math.random() < .5 ? -1 : 1) * (.5 + .5 * Math.random()) });
  return { p, pa };
}




function* combos(arr, l, start = 0, acc = []) {
  if (acc.length === l) { yield acc.slice(); return; }
  for (let a = start; a < arr.length; a++) { acc.push(arr[a]); yield* combos(arr, l, a + 1, acc); acc.pop(); }
}

// Oracle independence test: d-separation in the true DAG, via the linear-time reachability ("Bayes-ball") algorithm
// (Koller & Friedman, Alg. 3.1). Returns true when i and j are d-separated given S.
function dsepOracle(dag) {
  const { p, pa } = dag, par = pa.map(ps => ps.map(e => e.j)), chi = [...Array(p)].map(() => []);
  par.forEach((ps, v) => ps.forEach(u => chi[u].push(v)));
  return (i, j, S) => {
    const inZ = new Uint8Array(p), anZ = new Uint8Array(p), st = [...S];
    for (const z of S) inZ[z] = 1;
    while (st.length) { const v = st.pop(); if (anZ[v]) continue; anZ[v] = 1; for (const u of par[v]) st.push(u); } // Z and its ancestors
    const seen = new Uint8Array(2 * p), q = [i, 0]; // (node, dir): 0 = arrived from a child (moving up), 1 = from a parent (moving down)
    while (q.length) {
      const d = q.pop(), v = q.pop(); if (seen[2 * v + d]) continue; seen[2 * v + d] = 1;
      if (v === j && !inZ[v]) return false;
      if (d === 0 && !inZ[v]) { for (const u of par[v]) q.push(u, 0); for (const c of chi[v]) q.push(c, 1); }
      else if (d === 1) { if (!inZ[v]) for (const c of chi[v]) q.push(c, 1); if (anZ[v]) for (const u of par[v]) q.push(u, 0); }
    }
    return true;
  };
}

// the hero's generator: like makeDAG, but almost every variable gets a cause, so few dots float alone
function makeConnectedDAG(p, deg) {
  const d = makeDAG(p, deg);
  for (let i = 1; i < p; i++) if (!d.pa[i].length && Math.random() < .85) d.pa[i].push({ j: Math.floor(Math.random() * i), w: 1 });
  return d;
}

// distances in the true skeleton; with an oracle this stands in for association strength when ordering tests
function closeness(dag) {
  const { p, pa } = dag, nb = [...Array(p)].map(() => []); pa.forEach((ps, i) => ps.forEach(({ j }) => { nb[i].push(j); nb[j].push(i); }));
  return [...Array(p)].map((_, s) => { const d = new Array(p).fill(1e9); d[s] = 0; const q = [s]; for (let h = 0; h < q.length; h++) for (const u of nb[q[h]]) if (d[u] > d[q[h]] + 1) { d[u] = d[q[h]] + 1; q.push(u); } return d; });
}

// PC-stable skeleton + v-structures + Meek rules 1-3. indep(i, j, S) -> true when independent.
// order(i) optionally ranks candidate conditioning variables for i (closest first), like PC implementations that sort by association strength
function runPC(indep, p, maxDepth = Infinity, order = null, maxTests = Infinity) { // returns null if it would need more than maxTests tests
  let nTests = 0; const adj = [...Array(p)].map(() => new Set()), sepset = new Map(), events = [], key = (a, b) => a < b ? a + ',' + b : b + ',' + a;
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) if (i !== j) adj[i].add(j);
  for (let l = 0; l <= maxDepth; l++) {
    const snap = adj.map(s => [...s]); let any = false;
    for (let i = 0; i < p; i++) for (const j of snap[i]) {
      if (!adj[i].has(j)) continue;
      const nb = snap[i].filter(x => x !== j); if (nb.length < l) continue; any = true; if (order) nb.sort((a, b) => order[i][a] - order[i][b]);
      for (const S of combos(nb, l)) {
        if (++nTests > maxTests) return null;
        const ind = indep(i, j, S);
        events.push({ t: 'test', i, j, S, removed: ind });
        if (ind) { adj[i].delete(j); adj[j].delete(i); sepset.set(key(i, j), S); break; }
      }
    }
    if (!any) break;
  }
  // orientation: dir has 'a>b' when a->b
  const dir = new Set(), has = (a, b) => dir.has(a + '>' + b), und = (a, b) => adj[a].has(b) && !has(a, b) && !has(b, a);
  const orient = (a, b) => { if (has(a, b) || has(b, a)) return false; dir.add(a + '>' + b); events.push({ t: 'orient', a, b }); return true; };
  for (let k = 0; k < p; k++) { const nb = [...adj[k]]; for (let x = 0; x < nb.length; x++) for (let y = x + 1; y < nb.length; y++) {
    const i = nb[x], j = nb[y]; if (adj[i].has(j)) continue;
    if (!(sepset.get(key(i, j)) || []).includes(k)) { orient(i, k); orient(j, k); }
  } }
  let changed = true;
  while (changed) { changed = false;
    for (let b = 0; b < p; b++) for (const c of adj[b]) {
      if (!und(b, c)) continue;
      const nb = [...adj[b]];
      if (nb.some(a => a !== c && has(a, b) && !adj[a].has(c))                                                    // R1: a->b-c, a,c apart
        || nb.some(m => has(b, m) && has(m, c))                                                                    // R2: b->m->c
        || nb.some((x, xi) => und(b, x) && has(x, c) && nb.some((y, yi) => yi > xi && und(b, y) && has(y, c) && !adj[x].has(y)))) // R3
        { orient(b, c); changed = true; }
    }
  }
  return { events, adj, dir, sepset };
}

if (typeof module !== 'undefined') module.exports = { makeDAG, makeConnectedDAG, dsepOracle, closeness, runPC };
