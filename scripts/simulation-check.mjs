import { createSimulation, defaultParams, stepSimulation, runProbe } from "../src/simulation.js";

const params = defaultParams();
const short = createSimulation(params);
stepSimulation(short, 180);
if (short.history.at(0).population <= 0) throw new Error("initial population was not created");
if (Math.max(...short.history.map((h) => h.population)) <= params.initialPopulation) throw new Error("short run never increased population");
if (Math.max(...short.history.map((h) => h.maxLocalCrowding)) <= 0.8) throw new Error("local crowding did not emerge");
if (Math.max(...short.history.map((h) => h.averageTrauma)) <= 0.02) throw new Error("social stress/trauma did not accumulate");

const medium = createSimulation(params);
stepSimulation(medium, 650);
if (Math.max(...medium.history.map((h) => h.neglectEvents)) <= 0) throw new Error("parenting neglect did not occur");
if (medium.history.at(-1).averageSocialization >= 0.82) throw new Error("socialization did not degrade in medium run");

const runs = runProbe(params, 1100, 30);
const collapsed = runs.filter((r) => r.finalPopulation === 0 || r.status.includes("繁殖停止") || r.reproductiveStopDay !== null).length;
const ratio = collapsed / runs.length;
console.log(JSON.stringify({
  shortFinal: short.stats,
  mediumFinal: medium.stats,
  collapsed,
  runs: runs.length,
  ratio,
  outcomes: runs,
}, null, 2));
if (ratio < 0.6 || ratio > 0.98) throw new Error(`collapse ratio out of expected smoke-test range: ${ratio}`);
