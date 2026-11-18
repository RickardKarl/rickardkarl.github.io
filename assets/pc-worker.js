// Computes one hero run off the main thread: a random graph and the PC algorithm's events on it.
// Graphs that would need more than maxTests tests are skipped (they'd only look like a blur anyway).
importScripts('pc.js');
onmessage = ({ data: { id, P, deg, maxTests } }) => {
  let dag, run;
  do { dag = makeConnectedDAG(P, deg); run = runPC(dsepOracle(dag), P, Infinity, closeness(dag), maxTests); } while (!run);
  postMessage({ id, P, dag, events: run.events });
};
