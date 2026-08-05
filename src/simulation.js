export const controlsConfig = [
  ["initialPopulation", "初期投入ネズミ数", 8, 160, 4, 24, "実験開始時に投入する成体数です。"],
  ["foodSupply", "餌の投入数", 20, 1000, 10, 320, "多いほど身体的な生存率は上がりますが、社会崩壊は防ぎきれません。"],
  ["nestCount", "巣の数", 2, 100, 1, 24, "物理的な巣数です。安全に使えるかは個体能力と局所混雑に依存します。"],
  ["spaceSize", "居住空間の広さ", 40, 650, 10, 220, "広いほど全体密度は下がりますが、人気地点への集中は残ります。"],
  ["daySeconds", "1日が進む秒数", 0.25, 6, 0.25, 2, "2秒で1日が標準です。小さいほど高速です。"],
  ["birthRate", "繁殖しやすさ", 0, 100, 1, 72, "多段階繁殖の基礎的な試行頻度です。"],
  ["stressSensitivity", "密度ストレス感度", 0, 100, 1, 20, "局所混雑・接触・攻撃による社会的損傷の強さです。"],
  ["lifespan", "平均寿命（日）", 120, 1400, 20, 720, "身体的な自然寿命です。社会的離脱個体はやや長生きする場合があります。"],
  ["socialFragility", "社会崩壊しやすさ", 0, 100, 1, 30, "育児放棄・攻撃・社会能力低下の世代間連鎖の強さです。"],
];

const ADULT_AGE = 70;
const WEANING_AGE = 24;
const MAX_ANIMALS = 900;
const CHART_LIMIT = 2400;

export function defaultParams() {
  return Object.fromEntries(controlsConfig.map(([key,,,,, value]) => [key, value]));
}

export function createSimulation(params = defaultParams()) {
  const sim = {
    day: 0,
    nextId: 1,
    params: { ...params },
    animals: [],
    litters: [],
    communityResilience: Math.random(),
    history: [],
    last: emptyDailyStats(),
    status: "初期化",
  };

  for (let i = 0; i < Math.round(sim.params.initialPopulation); i += 1) {
    sim.animals.push(createAdult(sim, i % 2 === 0 ? "female" : "male"));
  }
  updateStats(sim);
  pushHistory(sim);
  return sim;
}

export function stepSimulation(sim, days = 1) {
  for (let i = 0; i < days; i += 1) simulateDay(sim);
  return sim;
}

export function runProbe(params = defaultParams(), days = 1200, runs = 12) {
  const results = [];
  for (let i = 0; i < runs; i += 1) {
    const sim = createSimulation(params);
    stepSimulation(sim, days);
    const final = sim.history.at(-1);
    const peak = Math.max(...sim.history.map((h) => h.population));
    const stopDay = sim.history.find((h) => h.reproductiveHealthIndex < 0.08 && h.juveniles === 0 && h.functionalBreeders < 2)?.day;
    results.push({ finalPopulation: final.population, peak, status: sim.status, reproductiveStopDay: stopDay ?? null });
  }
  return results;
}

function simulateDay(sim) {
  sim.day += 1;
  sim.last = emptyDailyStats();
  sim.animals.forEach((animal) => {
    animal.age += 1;
    animal.recentEncounterCount = 0;
    animal.recentAggressiveEncounterCount = 0;
    animal.sameNestPopulation = 0;
    animal.feedingAreaPopulation = 0;
    animal.pathCongestion = 0;
    animal.nearbyPopulation = 0;
    animal.daysSinceCare += animal.stage === "juvenile" ? 1 : 0;
  });

  assignBiasedLocations(sim);
  measureLocalSocialPressure(sim);
  updateSocialDamage(sim);
  assignTerritories(sim);
  processLitters(sim);
  processReproduction(sim);
  matureJuveniles(sim);
  processMortality(sim);
  updateStats(sim);
  pushHistory(sim);
}

function emptyDailyStats() {
  return {
    births: 0,
    deaths: 0,
    matingAttempts: 0,
    successfulMatings: 0,
    parentingAttempts: 0,
    successfulParenting: 0,
    neglectEvents: 0,
    weaned: 0,
    maxLocalCrowding: 0,
    aggressiveEncounters: 0,
  };
}

function createAdult(sim, sex) {
  const base = clamp01(randomNormal(0.82 + sim.communityResilience * 0.08, 0.08));
  const nestId = Math.floor(Math.random() * Math.max(1, sim.params.nestCount));
  return {
    id: sim.nextId++,
    sex,
    age: ADULT_AGE + Math.floor(Math.random() * 140),
    stage: "adult",
    x: Math.random(),
    y: Math.random(),
    vx: 0,
    vy: 0,
    nestId,
    parentNestId: nestId,
    feedingAreaId: Math.floor(Math.random() * 4),
    hasStableTerritory: false,
    territoryQuality: 0,
    state: "active",
    socialization: base,
    parentingAbility: clamp01(base + randomNormal(0, 0.06)),
    matingAbility: clamp01(base + randomNormal(0, 0.06)),
    territoryAbility: clamp01(base + randomNormal(0, 0.08)),
    socialStress: clamp01(randomNormal(0.08, 0.04)),
    trauma: clamp01(randomNormal(0.04, 0.03)),
    withdrawal: clamp01(randomNormal(0.08, 0.04)),
    aggression: clamp01(randomNormal(0.12, 0.05)),
    receivedCare: 0.8,
    experiencedNeglect: 0.05,
    experiencedAggression: 0.05,
    safeDevelopmentTime: 0.85,
    overcrowdingExposure: 0.05,
    inheritedSocialization: base,
    inheritedParentingAbility: base,
    inheritedMatingAbility: base,
    inheritedTerritoryAbility: base,
    recentEncounterCount: 0,
    recentAggressiveEncounterCount: 0,
    sameNestPopulation: 0,
    feedingAreaPopulation: 0,
    pathCongestion: 0,
    nearbyPopulation: 0,
    matingFailureCount: 0,
    daysSinceCare: 0,
    litterId: null,
  };
}

function createPup(sim, mother, father, litterId) {
  const inheritedSocialization = clamp01((mother.socialization + father.socialization) / 2 + randomNormal(0, 0.07));
  const inheritedParentingAbility = clamp01((mother.parentingAbility + father.parentingAbility) / 2 + randomNormal(0, 0.07));
  const inheritedMatingAbility = clamp01((mother.matingAbility + father.matingAbility) / 2 + randomNormal(0, 0.07));
  const inheritedTerritoryAbility = clamp01((mother.territoryAbility + father.territoryAbility) / 2 + randomNormal(0, 0.07));
  return {
    id: sim.nextId++,
    sex: Math.random() < 0.5 ? "female" : "male",
    age: 0,
    stage: "juvenile",
    x: mother.x + randomNormal(0, 0.02),
    y: mother.y + randomNormal(0, 0.02),
    vx: 0,
    vy: 0,
    nestId: mother.nestId,
    parentNestId: mother.nestId,
    feedingAreaId: mother.feedingAreaId,
    hasStableTerritory: false,
    territoryQuality: 0,
    state: "dependent",
    socialization: inheritedSocialization,
    parentingAbility: inheritedParentingAbility,
    matingAbility: inheritedMatingAbility,
    territoryAbility: inheritedTerritoryAbility,
    socialStress: clamp01(mother.socialStress * 0.35 + randomNormal(0.03, 0.03)),
    trauma: clamp01(mother.trauma * 0.18 + randomNormal(0.02, 0.02)),
    withdrawal: 0.08,
    aggression: 0.08,
    receivedCare: 0.1,
    experiencedNeglect: 0,
    experiencedAggression: 0,
    safeDevelopmentTime: 0.1,
    overcrowdingExposure: 0,
    inheritedSocialization,
    inheritedParentingAbility,
    inheritedMatingAbility,
    inheritedTerritoryAbility,
    recentEncounterCount: 0,
    recentAggressiveEncounterCount: 0,
    sameNestPopulation: 0,
    feedingAreaPopulation: 0,
    pathCongestion: 0,
    nearbyPopulation: 0,
    matingFailureCount: 0,
    daysSinceCare: 0,
    litterId,
  };
}

function assignBiasedLocations(sim) {
  const nestCount = Math.max(1, Math.round(sim.params.nestCount));
  const foodPoints = getFoodPoints();
  sim.animals.forEach((animal) => {
    const attractionToOldNest = animal.parentNestId ?? animal.nestId;
    const followsCrowd = Math.random() < 0.55 + animal.withdrawal * -0.25;
    if (!animal.hasStableTerritory && animal.stage === "adult") {
      animal.nestId = Math.random() < animal.territoryAbility * 0.45 ? attractionToOldNest % nestCount : preferredCrowdedNest(sim, attractionToOldNest, nestCount);
    } else if (Math.random() < 0.94) {
      animal.nestId = attractionToOldNest % nestCount;
    } else {
      animal.nestId = Math.floor(Math.random() * nestCount);
    }
    animal.feedingAreaId = followsCrowd ? preferredFoodArea(sim, animal.feedingAreaId) : Math.floor(Math.random() * foodPoints.length);
    const nestPoint = nestPosition(animal.nestId, nestCount);
    const foodPoint = foodPoints[animal.feedingAreaId];
    const pathBias = animal.stage === "juvenile" ? 0.18 : 0.34 + animal.withdrawal * 0.2;
    const target = Math.random() < pathBias ? foodPoint : nestPoint;
    const edgePush = animal.hasStableTerritory ? 0 : (1 - animal.territoryAbility) * 0.15;
    animal.x = clamp01(target.x + randomNormal(edgePush, 0.055 + animal.withdrawal * 0.03));
    animal.y = clamp01(target.y + randomNormal(edgePush * 0.4, 0.055 + animal.withdrawal * 0.03));
  });
}

function measureLocalSocialPressure(sim) {
  const animals = sim.animals;
  const nestCounts = new Map();
  const foodCounts = new Map();
  animals.forEach((animal) => {
    nestCounts.set(animal.nestId, (nestCounts.get(animal.nestId) ?? 0) + 1);
    foodCounts.set(animal.feedingAreaId, (foodCounts.get(animal.feedingAreaId) ?? 0) + 1);
  });
  for (let i = 0; i < animals.length; i += 1) {
    const a = animals[i];
    for (let j = i + 1; j < animals.length; j += 1) {
      const b = animals[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance < 0.12) {
        a.nearbyPopulation += 1;
        b.nearbyPopulation += 1;
        if (distance < 0.045 || a.nestId === b.nestId || a.feedingAreaId === b.feedingAreaId) {
          a.recentEncounterCount += 1;
          b.recentEncounterCount += 1;
          maybeAggressiveEncounter(sim, a, b);
        }
      }
    }
  }
  animals.forEach((animal) => {
    animal.sameNestPopulation = nestCounts.get(animal.nestId) ?? 0;
    animal.feedingAreaPopulation = foodCounts.get(animal.feedingAreaId) ?? 0;
    animal.pathCongestion = Math.max(0, animal.sameNestPopulation / 7 + animal.feedingAreaPopulation / 12 - 1);
    const localCrowding = localCrowdingOf(animal, sim);
    sim.last.maxLocalCrowding = Math.max(sim.last.maxLocalCrowding, localCrowding);
  });
}

function maybeAggressiveEncounter(sim, a, b) {
  const p = sim.params;
  const socialMismatch = Math.abs(a.socialization - b.socialization);
  const crowd = (localCrowdingOf(a, sim) + localCrowdingOf(b, sim)) / 2;
  const chance = clamp01((a.aggression + b.aggression) * 0.06 + socialMismatch * 0.03 + Math.max(0, crowd - 1) * 0.035);
  if (Math.random() > chance) return;
  const fragility = p.socialFragility / 100;
  const attacker = a.aggression + Math.random() * 0.25 > b.aggression + Math.random() * 0.25 ? a : b;
  const victim = attacker === a ? b : a;
  attacker.recentAggressiveEncounterCount += 1;
  victim.recentAggressiveEncounterCount += 1;
  attacker.socialStress = clamp01(attacker.socialStress + 0.025 * fragility);
  attacker.trauma = clamp01(attacker.trauma + 0.004 * fragility);
  victim.socialStress = clamp01(victim.socialStress + 0.06 * fragility);
  victim.trauma = clamp01(victim.trauma + 0.022 * fragility);
  victim.withdrawal = clamp01(victim.withdrawal + 0.05 * fragility);
  victim.aggression = clamp01(victim.aggression + randomNormal(0.025, 0.04) * fragility);
  victim.socialization = clamp01(victim.socialization - 0.008 * fragility);
  victim.parentingAbility = clamp01(victim.parentingAbility - 0.007 * fragility);
  victim.territoryAbility = clamp01(victim.territoryAbility - 0.008 * fragility);
  if (victim.stage === "juvenile") victim.experiencedAggression = clamp01(victim.experiencedAggression + 0.08 * fragility);
  sim.last.aggressiveEncounters += 1;
}

function updateSocialDamage(sim) {
  const p = sim.params;
  const stressFactor = p.stressSensitivity / 100;
  const fragility = p.socialFragility / 100;
  const resilienceBuffer = sim.communityResilience > 0.82 ? 0.72 : sim.communityResilience * 0.12;
  sim.animals.forEach((animal) => {
    const localCrowding = localCrowdingOf(animal, sim);
    const stressIncrease = (Math.max(0, localCrowding - 0.75) * 0.032 * stressFactor + animal.recentEncounterCount * 0.004 * stressFactor + animal.recentAggressiveEncounterCount * 0.035 * stressFactor) * (1 - resilienceBuffer);
    animal.socialStress = clamp01(animal.socialStress * 0.975 + stressIncrease);
    animal.trauma = clamp01(animal.trauma * (0.9991 - resilienceBuffer * 0.0008) + animal.recentAggressiveEncounterCount * 0.018 * fragility * (1 - resilienceBuffer) + Math.max(0, animal.socialStress - 0.78) * 0.002 * fragility * (1 - resilienceBuffer));
    if (animal.stage === "juvenile") {
      animal.overcrowdingExposure = clamp01(animal.overcrowdingExposure + Math.max(0, localCrowding - 0.85) * 0.018);
      animal.safeDevelopmentTime = clamp01(animal.safeDevelopmentTime + (localCrowding < 0.9 && animal.recentAggressiveEncounterCount === 0 ? 0.026 : -0.012));
    } else {
      animal.withdrawal = clamp01(animal.withdrawal + (animal.trauma - 0.42) * 0.003 + animal.socialStress * 0.001 - resilienceBuffer * 0.006);
      animal.aggression = clamp01(animal.aggression + (animal.socialStress - 0.5) * 0.003 - animal.withdrawal * 0.0008);
      if (animal.trauma > 0.48 && animal.socialization < 0.55 && (animal.matingFailureCount > 3 || animal.withdrawal > 0.78)) animal.state = "sociallyDetached";
      if (animal.state === "sociallyDetached") {
        animal.aggression = clamp01(animal.aggression * 0.985);
        animal.withdrawal = clamp01(Math.max(animal.withdrawal, 0.78));
        animal.socialStress = clamp01(animal.socialStress * 0.992);
      }
    }
  });
}

function assignTerritories(sim) {
  const adults = sim.animals.filter((a) => a.stage === "adult" && a.state !== "sociallyDetached");
  const stableBreedingPositions = Math.max(1, Math.round(sim.params.nestCount * (sim.communityResilience > 0.82 ? 3.2 : 1.75)));
  adults.sort((a, b) => breederScore(b) - breederScore(a));
  adults.forEach((animal, index) => {
    const local = localCrowdingOf(animal, sim);
    const eligible = index < stableBreedingPositions && animal.territoryAbility > (sim.communityResilience > 0.82 ? 0.22 : 0.3) && animal.socialization > (sim.communityResilience > 0.82 ? 0.24 : 0.3) && animal.trauma < (sim.communityResilience > 0.82 ? 0.9 : 0.78) && local < (sim.communityResilience > 0.82 ? 5.7 : 3.2);
    animal.hasStableTerritory = eligible && Math.random() < clamp01(breederScore(animal) * 1.1);
    animal.territoryQuality = animal.hasStableTerritory ? clamp01((1 - local / 3) * 0.5 + animal.territoryAbility * 0.5) : 0;
    if (!animal.hasStableTerritory && animal.age < 220) {
      animal.socialStress = clamp01(animal.socialStress + 0.012);
      if (animal.socialization < 0.5) animal.withdrawal = clamp01(animal.withdrawal + 0.01);
      else animal.aggression = clamp01(animal.aggression + 0.008);
    }
  });
}

function processReproduction(sim) {
  const p = sim.params;
  const adultFemales = sim.animals.filter(isPotentialFemale);
  const adultMales = sim.animals.filter(isPotentialMale);
  if (!adultFemales.length || !adultMales.length || sim.animals.length >= MAX_ANIMALS) return;
  const attemptRate = 0.024 + (p.birthRate / 100) * 0.07;
  adultFemales.forEach((female) => {
    if (Math.random() > attemptRate || sim.animals.length >= MAX_ANIMALS) return;
    sim.last.matingAttempts += 1;
    const male = chooseMate(female, adultMales);
    if (!male) {
      female.matingFailureCount += 1;
      return;
    }
    const encounterSuccess = clamp01(0.35 + proximityScore(female, male) * 0.35 - female.withdrawal * 0.22 - male.withdrawal * 0.18);
    const territoryQuality = Math.max(female.territoryQuality, male.territoryQuality, 0.08);
    const stressPenalty = clamp01(1 - (female.socialStress + male.socialStress) / 2 * 0.78 - (female.trauma + male.trauma) / 2 * 0.45);
    const courtshipSuccess = clamp01(encounterSuccess * female.socialization * male.socialization * female.matingAbility * male.matingAbility * (0.45 + territoryQuality) * stressPenalty);
    const matingSuccess = courtshipSuccess * clamp01(0.82 - female.withdrawal * 0.35 - male.withdrawal * 0.28);
    const pregnancySuccess = matingSuccess * clamp01(0.74 + Math.min(1.2, p.foodSupply / Math.max(1, sim.animals.length)) * 0.12 - female.trauma * 0.18);
    if (Math.random() > pregnancySuccess) {
      female.matingFailureCount += 1;
      male.matingFailureCount += 1;
      female.socialStress = clamp01(female.socialStress + 0.015);
      return;
    }
    female.matingFailureCount = Math.max(0, female.matingFailureCount - 1);
    male.matingFailureCount = Math.max(0, male.matingFailureCount - 1);
    sim.last.successfulMatings += 1;
    const litterSize = Math.max(1, Math.min(7, poisson(2.9 + p.birthRate / 42)));
    const litterId = `${sim.day}-${female.id}-${Math.random().toString(36).slice(2)}`;
    sim.litters.push({ id: litterId, motherId: female.id, fatherId: male.id, age: 0, size: litterSize, nestId: female.nestId, careContinuity: 1 });
    for (let i = 0; i < litterSize && sim.animals.length < MAX_ANIMALS; i += 1) {
      sim.animals.push(createPup(sim, female, male, litterId));
      sim.last.births += 1;
    }
  });
}

function processLitters(sim) {
  const resilienceBuffer = sim.communityResilience > 0.82 ? 0.72 : sim.communityResilience * 0.12;
  const survivors = [];
  sim.litters.forEach((litter) => {
    litter.age += 1;
    const mother = sim.animals.find((a) => a.id === litter.motherId);
    const pups = sim.animals.filter((a) => a.litterId === litter.id && a.stage === "juvenile");
    if (!mother || pups.length === 0) return;
    sim.last.parentingAttempts += 1;
    const local = localCrowdingOf(mother, sim);
    const nestSafety = clamp01(1.2 - local * 0.34 - mother.recentAggressiveEncounterCount * 0.08);
    const loadPenalty = clamp01(1 - Math.max(0, pups.length - 4) * 0.08);
    const careQuality = clamp01(mother.parentingAbility * 0.42 + mother.socialization * 0.16 + mother.territoryQuality * 0.15 + nestSafety * 0.18 + loadPenalty * 0.09 + resilienceBuffer * 0.22 - mother.trauma * 0.28 - mother.withdrawal * 0.24 - mother.aggression * 0.16 - mother.socialStress * 0.26);
    litter.careContinuity = clamp01(litter.careContinuity * 0.92 + careQuality * 0.08);
    if (careQuality > 0.45) sim.last.successfulParenting += 1;
    else sim.last.neglectEvents += 1;
    pups.forEach((pup) => {
      pup.receivedCare = clamp01(pup.receivedCare + careQuality * 0.055);
      pup.experiencedNeglect = clamp01(pup.experiencedNeglect + Math.max(0, 0.46 - careQuality) * 0.065);
      if (careQuality < 0.22 || mother.aggression > 0.72) pup.experiencedAggression = clamp01(pup.experiencedAggression + 0.035);
      pup.socialStress = clamp01(pup.socialStress + Math.max(0, 0.4 - careQuality) * 0.025 + Math.max(0, local - 1) * 0.014);
      pup.trauma = clamp01(pup.trauma + pup.experiencedNeglect * 0.002 + pup.experiencedAggression * 0.006);
    });
    if (litter.age < WEANING_AGE) survivors.push(litter);
    else sim.last.weaned += pups.length;
  });
  sim.litters = survivors;
}

function matureJuveniles(sim) {
  sim.animals.forEach((animal) => {
    if (animal.stage !== "juvenile" || animal.age < ADULT_AGE) return;
    animal.stage = "adult";
    animal.state = "active";
    const baseSocialization = animal.inheritedSocialization * 0.25 + animal.receivedCare * 0.35 + animal.safeDevelopmentTime * 0.25 - animal.experiencedNeglect * 0.25 - animal.experiencedAggression * 0.2 - animal.overcrowdingExposure * 0.15;
    animal.socialization = clamp01(baseSocialization + randomNormal(0, 0.04));
    animal.parentingAbility = clamp01(animal.inheritedParentingAbility * 0.3 + animal.receivedCare * 0.34 + animal.safeDevelopmentTime * 0.18 - animal.experiencedNeglect * 0.32 - animal.trauma * 0.16 + randomNormal(0, 0.04));
    animal.matingAbility = clamp01(animal.inheritedMatingAbility * 0.35 + animal.socialization * 0.35 + animal.safeDevelopmentTime * 0.14 - animal.experiencedAggression * 0.18 - animal.withdrawal * 0.1 + randomNormal(0, 0.04));
    animal.territoryAbility = clamp01(animal.inheritedTerritoryAbility * 0.35 + animal.socialization * 0.24 + animal.safeDevelopmentTime * 0.18 - animal.overcrowdingExposure * 0.2 - animal.experiencedAggression * 0.14 + randomNormal(0, 0.05));
    animal.withdrawal = clamp01(0.12 + animal.experiencedNeglect * 0.42 + animal.trauma * 0.26 - animal.receivedCare * 0.08);
    animal.aggression = clamp01(0.12 + animal.experiencedAggression * 0.38 + animal.socialStress * 0.18 - animal.receivedCare * 0.08 + randomNormal(0, 0.04));
    if (animal.trauma > 0.5 && animal.socialization < 0.5 && animal.withdrawal > 0.62) animal.state = "sociallyDetached";
  });
}

function processMortality(sim) {
  const p = sim.params;
  const foodHealth = Math.min(1.4, p.foodSupply / Math.max(1, sim.animals.length));
  const survivors = [];
  sim.animals.forEach((animal) => {
    let mortality = 1 / Math.max(1, p.lifespan);
    if (animal.stage === "juvenile") {
      mortality += Math.max(0, animal.experiencedNeglect - 0.38) * 0.018 + animal.experiencedAggression * 0.012 + Math.max(0, animal.socialStress - 0.65) * 0.01;
    }
    mortality += Math.max(0, 1 - foodHealth) * 0.018;
    mortality += Math.max(0, animal.socialStress - 0.86) * 0.004;
    mortality += animal.recentAggressiveEncounterCount * 0.0009;
    if (animal.state === "sociallyDetached") mortality *= 0.74;
    if (animal.age > p.lifespan * 1.8) mortality += 0.006 + (animal.age - p.lifespan * 1.8) / p.lifespan * 0.015;
    if (Math.random() < mortality) {
      sim.last.deaths += 1;
    } else {
      survivors.push(animal);
    }
  });
  sim.animals = survivors;
}

function updateStats(sim) {
  const animals = sim.animals;
  const adults = animals.filter((a) => a.stage === "adult");
  const juveniles = animals.filter((a) => a.stage === "juvenile");
  const fertileFemales = adults.filter(isPotentialFemale);
  const fertileMales = adults.filter(isPotentialMale);
  const functionalBreeders = adults.filter((a) => isFunctionalBreeder(a));
  const functionalParents = adults.filter((a) => isFunctionalParent(a));
  const detached = animals.filter((a) => a.state === "sociallyDetached");
  const stat = {
    population: animals.length,
    adults: adults.length,
    juveniles: juveniles.length,
    births: sim.last.births,
    deaths: sim.last.deaths,
    successfulMatings: sim.last.successfulMatings,
    successfulParenting: sim.last.successfulParenting,
    neglectEvents: sim.last.neglectEvents,
    averageSocialization: average(animals, "socialization"),
    averageParentingAbility: average(animals, "parentingAbility"),
    averageMatingAbility: average(animals, "matingAbility"),
    averageTrauma: average(animals, "trauma"),
    averageWithdrawal: average(animals, "withdrawal"),
    averageAggression: average(animals, "aggression"),
    sociallyDetachedCount: detached.length,
    sociallyDetachedRatio: ratio(detached.length, animals.length),
    functionalBreeders: functionalBreeders.length,
    functionalParents: functionalParents.length,
    fertileFemales: fertileFemales.length,
    fertileMales: fertileMales.length,
    successfulMatingRate: ratio(sim.last.successfulMatings, sim.last.matingAttempts),
    successfulParentingRate: ratio(sim.last.successfulParenting, sim.last.parentingAttempts),
    juvenileSurvivalRate: ratio(sim.last.weaned, Math.max(1, sim.last.births)),
    territoryAcquisitionRate: ratio(adults.filter((a) => a.hasStableTerritory).length, adults.length),
    maxLocalCrowding: sim.last.maxLocalCrowding,
    aggressiveEncounters: sim.last.aggressiveEncounters,
  };
  stat.socialHealthIndex = clamp01(stat.averageSocialization * 0.3 + stat.averageParentingAbility * 0.25 + stat.averageMatingAbility * 0.2 + stat.territoryAcquisitionRate * 0.15 + stat.juvenileSurvivalRate * 0.1 - stat.averageTrauma * 0.2 - stat.sociallyDetachedRatio * 0.25);
  stat.reproductiveHealthIndex = clamp01(stat.successfulMatingRate * 0.22 + stat.successfulParentingRate * 0.23 + stat.averageParentingAbility * 0.2 + stat.averageMatingAbility * 0.2 + ratio(functionalBreeders.length, adults.length) * 0.15 - stat.averageTrauma * 0.18 - stat.sociallyDetachedRatio * 0.2);
  sim.stats = stat;
  if (stat.population === 0) sim.status = "絶滅";
  else if ((stat.fertileFemales === 0 && stat.fertileMales === 0) || (stat.births === 0 && stat.juveniles === 0 && stat.functionalBreeders < 2 && stat.adults > 0)) sim.status = "繁殖停止 / 生物学的絶滅確定";
  else if (stat.reproductiveHealthIndex < 0.18 || stat.socialHealthIndex < 0.2) sim.status = "社会崩壊進行中";
  else if (stat.maxLocalCrowding > 1.5) sim.status = "局所過密";
  else sim.status = "成長・維持";
}

function pushHistory(sim) {
  sim.history.push({ day: sim.day, ...sim.stats });
  if (sim.history.length > CHART_LIMIT) sim.history.shift();
}

function isPotentialFemale(a) {
  return a.sex === "female" && isFunctionalBreeder(a);
}

function isPotentialMale(a) {
  return a.sex === "male" && isFunctionalBreeder(a);
}

function isFunctionalBreeder(a) {
  return a.stage === "adult" && a.state !== "sociallyDetached" && a.hasStableTerritory && a.socialization > 0.28 && a.matingAbility > 0.28 && a.socialStress < 0.84 && a.withdrawal < 0.84 && a.trauma < 0.84;
}

function isFunctionalParent(a) {
  return a.stage === "adult" && a.state !== "sociallyDetached" && a.parentingAbility > 0.34 && a.socialization > 0.3 && a.socialStress < 0.82 && a.trauma < 0.82;
}

function breederScore(a) {
  return clamp01(a.socialization * 0.24 + a.matingAbility * 0.24 + a.territoryAbility * 0.22 + a.parentingAbility * 0.12 + (1 - a.socialStress) * 0.08 + (1 - a.trauma) * 0.06 + (1 - a.withdrawal) * 0.04);
}

function chooseMate(female, males) {
  const candidates = males.filter((male) => male.id !== female.id && proximityScore(female, male) > 0.1);
  if (!candidates.length) return null;
  const weighted = candidates.map((male) => ({ male, weight: Math.max(0.001, proximityScore(female, male) * breederScore(male) * (male.hasStableTerritory ? 1.3 : 0.55)) }));
  const total = weighted.reduce((sum, item) => sum + item.weight, 0);
  let pick = Math.random() * total;
  for (const item of weighted) {
    pick -= item.weight;
    if (pick <= 0) return item.male;
  }
  return weighted.at(-1).male;
}

function proximityScore(a, b) {
  return clamp01(1 - Math.hypot(a.x - b.x, a.y - b.y) * 3 + (a.nestId === b.nestId ? 0.25 : 0) + (a.feedingAreaId === b.feedingAreaId ? 0.1 : 0));
}

function localCrowdingOf(animal, sim) {
  const nearbyCapacity = Math.max(5, Math.sqrt(sim.params.spaceSize) * 0.8);
  return animal.nearbyPopulation / nearbyCapacity + animal.sameNestPopulation / 8 + animal.feedingAreaPopulation / 18 + animal.pathCongestion * 0.45;
}

function preferredCrowdedNest(sim, fallback, nestCount) {
  if (sim.animals.length < 3 || Math.random() < 0.25) return fallback % nestCount;
  const sample = sim.animals[Math.floor(Math.random() * sim.animals.length)];
  return sample.nestId % nestCount;
}

function preferredFoodArea(sim, fallback) {
  if (sim.animals.length < 3 || Math.random() < 0.35) return fallback ?? 0;
  return sim.animals[Math.floor(Math.random() * sim.animals.length)].feedingAreaId ?? 0;
}

function nestPosition(id, nestCount) {
  const cols = Math.ceil(Math.sqrt(nestCount));
  const rows = Math.ceil(nestCount / cols);
  return { x: 0.08 + (id % cols) / Math.max(1, cols - 1) * 0.72, y: 0.64 + Math.floor(id / cols) / Math.max(1, rows - 1) * 0.26 };
}

function getFoodPoints() {
  return [
    { x: 0.82, y: 0.14 },
    { x: 0.9, y: 0.24 },
    { x: 0.78, y: 0.32 },
    { x: 0.88, y: 0.42 },
  ];
}

function poisson(lambda) {
  if (lambda <= 0) return 0;
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = 1;
  do {
    k += 1;
    product *= Math.random();
  } while (product > limit && k < lambda * 5 + 25);
  return k - 1;
}

function average(items, key) {
  if (!items.length) return 0;
  return clamp01(items.reduce((sum, item) => sum + item[key], 0) / items.length);
}

function ratio(value, total) {
  return total > 0 ? clamp01(value / total) : 0;
}

function randomNormal(mean = 0, sd = 1) {
  const u = 1 - Math.random();
  const v = Math.random();
  return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * sd;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}
