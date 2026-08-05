import { controlsConfig, createSimulation, defaultParams, stepSimulation } from "./simulation.js";

const uiState = {
  running: false,
  params: defaultParams(),
  sim: null,
  lastTick: performance.now(),
  accumulator: 0,
};

const controls = document.querySelector("#controls");
const debugGrid = document.querySelector("#debugGrid");
const colonyCanvas = document.querySelector("#colonyCanvas");
const chartCanvas = document.querySelector("#populationChart");
const colonyCtx = colonyCanvas.getContext("2d");
const chartCtx = chartCanvas.getContext("2d");
const toggleButton = document.querySelector("#toggleSimulation");

function makeControls() {
  controlsConfig.forEach(([key, label, min, max, step, value, help]) => {
    const wrapper = document.createElement("div");
    wrapper.className = "control";
    wrapper.innerHTML = `
      <label for="${key}"><span>${label}</span><strong id="${key}Value">${value}</strong></label>
      <input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${value}" />
      <small>${help}</small>`;
    controls.appendChild(wrapper);
    const input = wrapper.querySelector("input");
    input.addEventListener("input", () => {
      uiState.params[key] = Number(input.value);
      document.querySelector(`#${key}Value`).textContent = input.value;
      if (["initialPopulation", "foodSupply", "nestCount", "spaceSize", "birthRate", "stressSensitivity", "lifespan", "socialFragility"].includes(key)) resetSimulation();
    });
  });
}

function resetSimulation() {
  uiState.sim = createSimulation(uiState.params);
  uiState.lastTick = performance.now();
  uiState.accumulator = 0;
  updateReadouts();
  draw();
}

function updateReadouts() {
  const { sim } = uiState;
  const stats = sim.stats;
  document.querySelector("#dayCounter").textContent = `${sim.day} 日`;
  document.querySelector("#populationNow").textContent = stats.population.toLocaleString("ja-JP");
  document.querySelector("#birthsNow").textContent = stats.births.toLocaleString("ja-JP");
  document.querySelector("#deathsNow").textContent = stats.deaths.toLocaleString("ja-JP");
  document.querySelector("#statusNow").textContent = sim.status;
  debugGrid.innerHTML = debugRows(stats).map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function debugRows(stats) {
  return [
    ["現在個体数", stats.population],
    ["成体数", stats.adults],
    ["幼体数", stats.juveniles],
    ["出生数", stats.births],
    ["死亡数", stats.deaths],
    ["繁殖成功数", stats.successfulMatings],
    ["育児成功数", stats.successfulParenting],
    ["育児放棄数", stats.neglectEvents],
    ["平均社会化能力", pct(stats.averageSocialization)],
    ["平均育児能力", pct(stats.averageParentingAbility)],
    ["平均交尾能力", pct(stats.averageMatingAbility)],
    ["平均トラウマ", pct(stats.averageTrauma)],
    ["社会的離脱個体数", stats.sociallyDetachedCount],
    ["正常繁殖可能個体数", stats.functionalBreeders],
    ["正常育児可能個体数", stats.functionalParents],
    ["局所過密の最大値", stats.maxLocalCrowding.toFixed(2)],
    ["社会的健全性指数", pct(stats.socialHealthIndex)],
    ["繁殖健全性指数", pct(stats.reproductiveHealthIndex)],
  ];
}

function draw() {
  drawColony();
  drawChart();
}

function drawColony() {
  const { width, height } = colonyCanvas;
  colonyCtx.clearRect(0, 0, width, height);
  colonyCtx.fillStyle = "#08111f";
  colonyCtx.fillRect(0, 0, width, height);
  drawResources(width, height);
  const visibleAnimals = uiState.sim.animals.slice(0, 260);
  visibleAnimals.forEach((mouse) => drawMouse(mouse, width, height));
  if (uiState.sim.animals.length > visibleAnimals.length) {
    colonyCtx.fillStyle = "rgba(248,250,252,0.72)";
    colonyCtx.font = "18px sans-serif";
    colonyCtx.fillText(`+${uiState.sim.animals.length - visibleAnimals.length} 匹`, 22, 34);
  }
}

function drawResources(width, height) {
  const nests = Math.min(uiState.params.nestCount, 60);
  const food = Math.min(uiState.params.foodSupply / 14, 48);
  for (let i = 0; i < nests; i += 1) {
    const x = 58 + (i % 10) * 82;
    const y = height - 54 - Math.floor(i / 10) * 36;
    colonyCtx.fillStyle = "rgba(251, 191, 36, 0.18)";
    polygon(colonyCtx, x, y, 22, 6, -Math.PI / 6);
    colonyCtx.fill();
  }
  for (let i = 0; i < food; i += 1) {
    const x = width - 68 - (i % 8) * 34;
    const y = 54 + Math.floor(i / 8) * 34;
    colonyCtx.fillStyle = "rgba(69, 215, 182, 0.5)";
    polygon(colonyCtx, x, y, 8, 5, 0);
    colonyCtx.fill();
  }
}

function drawMouse(mouse, width, height) {
  const x = mouse.x * width;
  const y = mouse.y * height;
  const size = mouse.stage === "juvenile" ? 7 : 12;
  const hue = mouse.state === "sociallyDetached" ? 205 : 24 + mouse.socialization * 40;
  colonyCtx.save();
  colonyCtx.translate(x, y);
  colonyCtx.rotate(Math.sin(mouse.id + uiState.sim.day / 12) * 0.7);
  colonyCtx.globalAlpha = mouse.stage === "juvenile" ? 0.72 : 1;
  colonyCtx.fillStyle = `hsl(${hue} 70% ${mouse.state === "sociallyDetached" ? 74 : 78}%)`;
  polygon(colonyCtx, 0, 0, size, 7, 0);
  colonyCtx.fill();
  colonyCtx.fillStyle = `hsl(${hue} 68% 66%)`;
  polygon(colonyCtx, -size * 0.34, -size * 0.72, size * 0.32, 5, 0);
  polygon(colonyCtx, -size * 0.34, size * 0.72, size * 0.32, 5, 0);
  colonyCtx.fill();
  colonyCtx.fillStyle = "#111827";
  colonyCtx.beginPath();
  colonyCtx.arc(size * 0.42, -size * 0.24, 1.4, 0, Math.PI * 2);
  colonyCtx.arc(size * 0.42, size * 0.24, 1.4, 0, Math.PI * 2);
  colonyCtx.fill();
  colonyCtx.strokeStyle = mouse.hasStableTerritory ? "rgba(69,215,182,0.9)" : `hsl(${hue} 60% 74%)`;
  colonyCtx.lineWidth = mouse.hasStableTerritory ? 3 : 2;
  colonyCtx.beginPath();
  colonyCtx.moveTo(-size * 0.95, 0);
  colonyCtx.quadraticCurveTo(-size * 1.6, -size * 0.55, -size * 2.2, 0);
  colonyCtx.stroke();
  if (mouse.socialStress > 0.72 || mouse.trauma > 0.65) {
    colonyCtx.strokeStyle = "rgba(251,113,133,0.78)";
    colonyCtx.lineWidth = 1.4;
    colonyCtx.strokeRect(-size * 0.85, -size * 0.85, size * 1.7, size * 1.7);
  }
  colonyCtx.restore();
}

function polygon(ctx, x, y, radius, sides, rotation) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawChart() {
  const { width, height } = chartCanvas;
  const pad = 46;
  const history = uiState.sim.history;
  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = "#07101f";
  chartCtx.fillRect(0, 0, width, height);
  if (history.length < 2) return;
  const maxPopulation = Math.max(uiState.params.initialPopulation, ...history.map((d) => d.population), 10);
  const maxDaily = Math.max(...history.map((d) => Math.max(d.births, d.deaths)), 4);
  const minDay = history[0].day;
  const maxDay = history.at(-1).day || 1;
  const xOf = (day) => pad + ((day - minDay) / Math.max(1, maxDay - minDay)) * (width - pad * 1.35);
  const yPopulation = (population) => height - pad - (population / maxPopulation) * (height - pad * 1.8);
  const yRate = (value) => height - pad - value * (height - pad * 1.8);
  const yDaily = (value) => height - pad - (value / maxDaily) * (height - pad * 1.8);
  drawGrid(pad, width, height, maxPopulation);
  const baselineY = yPopulation(uiState.params.initialPopulation);
  drawDashedLine(pad, width - pad / 2, baselineY, "rgba(255,255,255,0.35)");
  drawSegmentedPopulation(history, xOf, yPopulation);
  drawSeries(history, "births", xOf, yDaily, "#7dd3fc", 2);
  drawSeries(history, "deaths", xOf, yDaily, "#f97316", 2);
  drawSeries(history, "averageSocialization", xOf, yRate, "#a78bfa", 2);
  drawSeries(history, "averageParentingAbility", xOf, yRate, "#facc15", 2);
  drawSeries(history, "sociallyDetachedRatio", xOf, yRate, "#94a3b8", 2);
  drawSeries(history, "socialHealthIndex", xOf, yRate, "#22c55e", 3);
}

function drawSegmentedPopulation(history, xOf, yOf) {
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const curr = history[i];
    chartCtx.strokeStyle = curr.population >= uiState.params.initialPopulation ? "#45d7b6" : "#fb7185";
    chartCtx.lineWidth = 4;
    chartCtx.beginPath();
    chartCtx.moveTo(xOf(prev.day), yOf(prev.population));
    chartCtx.lineTo(xOf(curr.day), yOf(curr.population));
    chartCtx.stroke();
  }
}

function drawSeries(history, key, xOf, yOf, color, width) {
  chartCtx.strokeStyle = color;
  chartCtx.lineWidth = width;
  chartCtx.beginPath();
  history.forEach((point, index) => {
    const x = xOf(point.day);
    const y = yOf(point[key] ?? 0);
    if (index === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });
  chartCtx.stroke();
}

function drawGrid(pad, width, height, maxPopulation) {
  chartCtx.strokeStyle = "rgba(255,255,255,0.08)";
  chartCtx.fillStyle = "rgba(248,250,252,0.62)";
  chartCtx.font = "15px sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + ((height - pad * 1.8) * i) / 4;
    chartCtx.beginPath();
    chartCtx.moveTo(pad, y);
    chartCtx.lineTo(width - pad / 2, y);
    chartCtx.stroke();
    chartCtx.fillText(Math.round(maxPopulation * (1 - i / 4)), 8, y + 5);
  }
}

function drawDashedLine(x1, x2, y, color) {
  chartCtx.strokeStyle = color;
  chartCtx.setLineDash([8, 8]);
  chartCtx.beginPath();
  chartCtx.moveTo(x1, y);
  chartCtx.lineTo(x2, y);
  chartCtx.stroke();
  chartCtx.setLineDash([]);
}

function loop(now) {
  const elapsed = (now - uiState.lastTick) / 1000;
  uiState.lastTick = now;
  if (uiState.running) {
    uiState.accumulator += elapsed;
    while (uiState.accumulator >= uiState.params.daySeconds) {
      stepSimulation(uiState.sim, 1);
      uiState.accumulator -= uiState.params.daySeconds;
      updateReadouts();
    }
  }
  draw();
  requestAnimationFrame(loop);
}

function pct(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

toggleButton.addEventListener("click", () => {
  uiState.running = !uiState.running;
  toggleButton.textContent = uiState.running ? "一時停止" : "開始";
  uiState.lastTick = performance.now();
});
document.querySelector("#resetSimulation").addEventListener("click", resetSimulation);
document.querySelector("#shareResult").addEventListener("click", () => {
  const peak = Math.max(...uiState.sim.history.map((d) => d.population));
  const text = `Universe25シミュレーター結果: ${uiState.sim.day}日経過、現在${uiState.sim.stats.population}匹、最大${peak}匹。状態: ${uiState.sim.status}。社会健全性${pct(uiState.sim.stats.socialHealthIndex)}。`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

makeControls();
resetSimulation();
requestAnimationFrame(loop);
