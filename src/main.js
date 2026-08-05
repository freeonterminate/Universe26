const controlsConfig = [
  ["initialPopulation", "初期投入ネズミ数", 8, 120, 4, 24, "実験開始時に投入する個体数です。"],
  ["foodSupply", "餌の投入数", 20, 420, 10, 170, "多いほど出生率と生存率が上がります。"],
  ["nestCount", "巣の数", 2, 80, 1, 20, "繁殖に使える安全な巣の数です。"],
  ["spaceSize", "居住空間の広さ", 40, 500, 10, 220, "広いほど密度ストレスが下がります。"],
  ["daySeconds", "1日が進む秒数", 0.25, 6, 0.25, 2, "2秒で1日が標準です。小さいほど高速です。"],
  ["birthRate", "繁殖しやすさ", 0, 100, 1, 42, "餌と巣が足りている場合の増えやすさです。"],
  ["stressSensitivity", "密度ストレス感度", 0, 100, 1, 48, "過密時の出生低下・死亡増加の強さです。"],
  ["lifespan", "平均寿命（日）", 120, 1400, 20, 720, "寿命が長いほど自然減が緩やかになります。"],
];

const state = {
  running: false,
  day: 0,
  population: 0,
  births: 0,
  deaths: 0,
  params: Object.fromEntries(controlsConfig.map(([key,,,,, value]) => [key, value])),
  history: [],
  mice: [],
  lastTick: performance.now(),
  accumulator: 0,
};

const controls = document.querySelector("#controls");
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
      state.params[key] = Number(input.value);
      document.querySelector(`#${key}Value`).textContent = input.value;
      if (["initialPopulation", "foodSupply", "nestCount", "spaceSize"].includes(key)) resetSimulation();
    });
  });
}

function resetSimulation() {
  state.day = 0;
  state.population = Math.round(state.params.initialPopulation);
  state.births = 0;
  state.deaths = 0;
  state.history = [{ day: 0, population: state.population }];
  state.mice = Array.from({ length: Math.min(state.population, 180) }, createMouse);
  state.lastTick = performance.now();
  state.accumulator = 0;
  updateReadouts();
  draw();
}

function createMouse() {
  return {
    x: Math.random() * colonyCanvas.width,
    y: Math.random() * colonyCanvas.height,
    vx: (Math.random() - 0.5) * 0.7,
    vy: (Math.random() - 0.5) * 0.7,
    size: 8 + Math.random() * 8,
    hue: 25 + Math.random() * 24,
    blink: Math.random() * Math.PI * 2,
  };
}

function simulateDay() {
  const p = state.params;
  const foodPressure = Math.min(1.6, p.foodSupply / Math.max(1, state.population));
  const nestPressure = Math.min(1.4, (p.nestCount * 3) / Math.max(1, state.population));
  const density = state.population / p.spaceSize;
  const stress = Math.max(0, density - 0.8) * (p.stressSensitivity / 100);
  const birthChance = Math.max(0, (p.birthRate / 100) * 0.085 * foodPressure * nestPressure * (1 - stress));
  const deathChance = Math.min(0.42, 1 / p.lifespan + Math.max(0, 1 - foodPressure) * 0.045 + stress * 0.075);

  const births = poisson(state.population * birthChance);
  const deaths = Math.min(state.population, poisson(state.population * deathChance));
  state.population = Math.max(0, state.population + births - deaths);
  state.births = births;
  state.deaths = deaths;
  state.day += 1;
  state.history.push({ day: state.day, population: state.population });
  if (state.history.length > 720) state.history.shift();
  syncMice();
  updateReadouts();
}

function poisson(lambda) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = 1;
  do { k += 1; product *= Math.random(); } while (product > limit && k < lambda * 5 + 25);
  return k - 1;
}

function syncMice() {
  const visible = Math.min(state.population, 220);
  while (state.mice.length < visible) state.mice.push(createMouse());
  state.mice.length = visible;
}

function updateReadouts() {
  document.querySelector("#dayCounter").textContent = `${state.day} 日`;
  document.querySelector("#populationNow").textContent = state.population.toLocaleString("ja-JP");
  document.querySelector("#birthsNow").textContent = state.births.toLocaleString("ja-JP");
  document.querySelector("#deathsNow").textContent = state.deaths.toLocaleString("ja-JP");
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
  state.mice.forEach((mouse) => {
    mouse.x += mouse.vx;
    mouse.y += mouse.vy;
    if (mouse.x < 12 || mouse.x > width - 12) mouse.vx *= -1;
    if (mouse.y < 12 || mouse.y > height - 12) mouse.vy *= -1;
    drawMouse(mouse);
  });
}

function drawResources(width, height) {
  const nests = Math.min(state.params.nestCount, 36);
  const food = Math.min(state.params.foodSupply / 12, 32);
  for (let i = 0; i < nests; i += 1) {
    const x = 58 + (i % 9) * 88;
    const y = height - 54 - Math.floor(i / 9) * 38;
    colonyCtx.fillStyle = "rgba(251, 191, 36, 0.18)";
    polygon(x, y, 22, 6, -Math.PI / 6);
    colonyCtx.fill();
  }
  for (let i = 0; i < food; i += 1) {
    const x = width - 68 - (i % 8) * 34;
    const y = 54 + Math.floor(i / 8) * 34;
    colonyCtx.fillStyle = "rgba(69, 215, 182, 0.5)";
    polygon(x, y, 8, 5, 0);
    colonyCtx.fill();
  }
}

function drawMouse(mouse) {
  const { x, y, size, hue } = mouse;
  colonyCtx.save();
  colonyCtx.translate(x, y);
  colonyCtx.rotate(Math.atan2(mouse.vy, mouse.vx));
  colonyCtx.fillStyle = `hsl(${hue} 70% 78%)`;
  polygon(0, 0, size, 7, 0);
  colonyCtx.fill();
  colonyCtx.fillStyle = `hsl(${hue} 68% 66%)`;
  polygon(-size * 0.35, -size * 0.72, size * 0.32, 5, 0);
  polygon(-size * 0.35, size * 0.72, size * 0.32, 5, 0);
  colonyCtx.fill();
  colonyCtx.fillStyle = "#111827";
  colonyCtx.beginPath();
  colonyCtx.arc(size * 0.42, -size * 0.24, 1.5, 0, Math.PI * 2);
  colonyCtx.arc(size * 0.42, size * 0.24, 1.5, 0, Math.PI * 2);
  colonyCtx.fill();
  colonyCtx.strokeStyle = `hsl(${hue} 60% 74%)`;
  colonyCtx.lineWidth = 2;
  colonyCtx.beginPath();
  colonyCtx.moveTo(-size * 0.95, 0);
  colonyCtx.quadraticCurveTo(-size * 1.6, -size * 0.55, -size * 2.2, 0);
  colonyCtx.stroke();
  colonyCtx.restore();
}

function polygon(x, y, radius, sides, rotation) {
  colonyCtx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (Math.PI * 2 * i) / sides;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) colonyCtx.moveTo(px, py); else colonyCtx.lineTo(px, py);
  }
  colonyCtx.closePath();
}

function drawChart() {
  const { width, height } = chartCanvas;
  const pad = 42;
  const history = state.history;
  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = "#07101f";
  chartCtx.fillRect(0, 0, width, height);
  if (history.length < 2) return;
  const maxPopulation = Math.max(state.params.initialPopulation, ...history.map((d) => d.population), 10);
  const minDay = history[0].day;
  const maxDay = history.at(-1).day || 1;
  const xOf = (day) => pad + ((day - minDay) / Math.max(1, maxDay - minDay)) * (width - pad * 1.5);
  const yOf = (population) => height - pad - (population / maxPopulation) * (height - pad * 1.7);
  drawGrid(pad, width, height, maxPopulation);
  const baselineY = yOf(state.params.initialPopulation);
  chartCtx.strokeStyle = "rgba(255,255,255,0.35)";
  chartCtx.setLineDash([8, 8]);
  chartCtx.beginPath();
  chartCtx.moveTo(pad, baselineY);
  chartCtx.lineTo(width - pad / 2, baselineY);
  chartCtx.stroke();
  chartCtx.setLineDash([]);
  for (let i = 1; i < history.length; i += 1) {
    const prev = history[i - 1];
    const curr = history[i];
    chartCtx.strokeStyle = curr.population >= state.params.initialPopulation ? "#45d7b6" : "#fb7185";
    chartCtx.lineWidth = 4;
    chartCtx.beginPath();
    chartCtx.moveTo(xOf(prev.day), yOf(prev.population));
    chartCtx.lineTo(xOf(curr.day), yOf(curr.population));
    chartCtx.stroke();
  }
}

function drawGrid(pad, width, height, maxPopulation) {
  chartCtx.strokeStyle = "rgba(255,255,255,0.08)";
  chartCtx.fillStyle = "rgba(248,250,252,0.62)";
  chartCtx.font = "16px sans-serif";
  for (let i = 0; i <= 4; i += 1) {
    const y = pad + ((height - pad * 1.7) * i) / 4;
    chartCtx.beginPath();
    chartCtx.moveTo(pad, y);
    chartCtx.lineTo(width - pad / 2, y);
    chartCtx.stroke();
    chartCtx.fillText(Math.round(maxPopulation * (1 - i / 4)), 8, y + 5);
  }
}

function loop(now) {
  const elapsed = (now - state.lastTick) / 1000;
  state.lastTick = now;
  if (state.running) {
    state.accumulator += elapsed;
    while (state.accumulator >= state.params.daySeconds) {
      simulateDay();
      state.accumulator -= state.params.daySeconds;
    }
  }
  draw();
  requestAnimationFrame(loop);
}

toggleButton.addEventListener("click", () => {
  state.running = !state.running;
  toggleButton.textContent = state.running ? "一時停止" : "開始";
  state.lastTick = performance.now();
});
document.querySelector("#resetSimulation").addEventListener("click", resetSimulation);
document.querySelector("#shareResult").addEventListener("click", () => {
  const peak = Math.max(...state.history.map((d) => d.population));
  const text = `Universe25シミュレーター結果: ${state.day}日経過、現在${state.population}匹、最大${peak}匹。初期${state.params.initialPopulation}匹から実験しました。`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(location.href)}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

makeControls();
resetSimulation();
requestAnimationFrame(loop);
