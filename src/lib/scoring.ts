import { Car, Preferences, Priority, ScoredCar, Usage } from "./types";

/**
 * The recommendation engine. Two stages:
 *  1. Hard filters narrow the dataset to cars that fit the buyer's
 *     non-negotiables (budget, seating, body/fuel/transmission). If that
 *     wipes everything out, constraints are relaxed step by step so the
 *     buyer always gets a shortlist instead of an empty screen.
 *  2. Each surviving car is scored 0-100 on five factors. The factor
 *     weights come from the buyer's stated priorities and usage, so the
 *     same car ranks differently for a city commuter vs. a highway family.
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Linear map of `v` from [a1,a2] onto [b1,b2], clamped to the output range. */
function mapRange(v: number, a1: number, a2: number, b1: number, b2: number) {
  const t = (v - a1) / (a2 - a1);
  return clamp(b1 + t * (b2 - b1), Math.min(b1, b2), Math.max(b1, b2));
}

// ----- Per-factor scores (each 0-100, comparable across the whole dataset) -----

function safetyScore(car: Car): number {
  // Untested isn't "unsafe" — treat it as a neutral 50 rather than zero.
  return car.safetyRating > 0 ? (car.safetyRating / 5) * 100 : 50;
}

function efficiencyScore(car: Car): number {
  // Captures real running cost, not just the headline number, so an EV's
  // "421 km range" and a petrol's "25 kmpl" don't get compared on one scale.
  switch (car.fuel) {
    case "Electric":
      return 100;
    case "CNG":
      return 92;
    case "Hybrid":
      return 90;
    default:
      return mapRange(car.mileage, 12, 27, 35, 82);
  }
}

function performanceScore(car: Car): number {
  return mapRange(car.powerBhp, 55, 185, 30, 100);
}

function spaceScore(car: Car): number {
  const seats = mapRange(car.seating, 4, 7, 45, 100);
  const boot = mapRange(car.bootSpace, 200, 530, 35, 100);
  return 0.55 * seats + 0.45 * boot;
}

function valueScore(car: Car): number {
  // Cheaper is better, nudged up by the safety/efficiency you get for the money.
  const priceScore = mapRange(car.price, 5, 25, 100, 40);
  return 0.6 * priceScore + 0.2 * safetyScore(car) + 0.2 * efficiencyScore(car);
}

const FACTORS: Record<Priority, (c: Car) => number> = {
  safety: safetyScore,
  mileage: efficiencyScore,
  performance: performanceScore,
  space: spaceScore,
  value: valueScore,
};

// ----- Weighting -----

/** Base weight for every factor, plus a big bump for what the buyer ranked. */
function buildWeights(priorities: Priority[], usage: Usage): Record<Priority, number> {
  const weights: Record<Priority, number> = {
    safety: 1,
    mileage: 1,
    performance: 1,
    space: 1,
    value: 1,
  };

  // Earlier in the priority list = larger boost.
  priorities.forEach((p, i) => {
    weights[p] += Math.max(3 - i, 1);
  });

  const usageMultipliers: Record<Usage, Partial<Record<Priority, number>>> = {
    city: { mileage: 1.3, performance: 0.8, space: 0.8 },
    highway: { performance: 1.3, safety: 1.2, mileage: 1.1 },
    family: { space: 1.4, safety: 1.3, performance: 0.8 },
    mixed: {},
  };

  const mult = usageMultipliers[usage];
  (Object.keys(mult) as Priority[]).forEach((k) => {
    weights[k] *= mult[k]!;
  });

  return weights;
}

// ----- Hard filters with graceful relaxation -----

function passesBudget(car: Car, p: Preferences) {
  return car.price >= p.budgetMin * 0.8 && car.price <= p.budgetMax * 1.08;
}

/** True if the car matches any of the buyer's brand/model keywords (or none given). */
function matchesMake(car: Car, p: Preferences) {
  if (!p.makes || p.makes.length === 0) return true;
  const hay = `${car.make} ${car.model} ${car.variant}`.toLowerCase();
  return p.makes.some((m) => hay.includes(m.toLowerCase().trim()));
}

interface FilterStage {
  label: string;
  test: (car: Car, p: Preferences) => boolean;
}

// Ordered loosest-to-tightest. A named brand/model is a hard intent, so it is
// kept through every stage except the very last fallback; styling preferences
// (body/fuel/transmission) get dropped first, then seating, then budget.
const STAGES: FilterStage[] = [
  {
    label: "all preferences",
    test: (c, p) =>
      matchesMake(c, p) &&
      passesBudget(c, p) &&
      c.seating >= p.seating &&
      (p.bodyTypes.length === 0 || p.bodyTypes.includes(c.bodyType)) &&
      (p.fuels.length === 0 || p.fuels.includes(c.fuel)) &&
      (p.transmission === "Any" || c.transmission === p.transmission),
  },
  {
    label: "relaxed transmission & fuel",
    test: (c, p) =>
      matchesMake(c, p) &&
      passesBudget(c, p) &&
      c.seating >= p.seating &&
      (p.bodyTypes.length === 0 || p.bodyTypes.includes(c.bodyType)),
  },
  {
    label: "budget & seating only",
    test: (c, p) => matchesMake(c, p) && passesBudget(c, p) && c.seating >= p.seating,
  },
  {
    label: "budget only",
    test: (c, p) => matchesMake(c, p) && passesBudget(c, p),
  },
  {
    label: "brand match only",
    test: (c, p) => p.makes.length > 0 && matchesMake(c, p),
  },
];

function filterCars(cars: Car[], p: Preferences): { matches: Car[]; relaxedNote: string | null } {
  for (let i = 0; i < STAGES.length; i++) {
    const matches = cars.filter((c) => STAGES[i].test(c, p));
    if (matches.length > 0) {
      return {
        matches,
        relaxedNote: i === 0 ? null : `We widened the search (${STAGES[i].label}) to find these.`,
      };
    }
  }
  return { matches: cars, relaxedNote: "Nothing matched your budget, so here's the closest we have." };
}

// ----- Reasons -----

function buildReasons(car: Car, p: Preferences, breakdown: Record<string, number>): string[] {
  const reasons: string[] = [];

  if (car.price <= p.budgetMax) {
    reasons.push(`Fits your ₹${p.budgetMin}-${p.budgetMax}L budget at ₹${car.price}L`);
  } else {
    reasons.push(`Just above budget at ₹${car.price}L — worth a stretch`);
  }

  if (car.safetyRating >= 4) {
    reasons.push(`${car.safetyRating}-star Global NCAP — strong on safety`);
  }
  if (car.fuel === "Electric") {
    reasons.push(`${car.mileage} km range with near-zero running cost`);
  } else if (car.fuel === "Hybrid" || car.fuel === "CNG") {
    reasons.push(`${car.fuel} — very low fuel cost (${car.mileage}${car.fuel === "CNG" ? " km/kg" : " kmpl"})`);
  } else if (car.mileage >= 22) {
    reasons.push(`High mileage at ${car.mileage} kmpl`);
  }
  if (car.seating >= 7) {
    reasons.push(`Seats ${car.seating} — room for the whole family`);
  }
  if (breakdown.performance >= 80) {
    reasons.push(`Punchy ${car.powerBhp} bhp for confident highway runs`);
  }

  // Always surface one editorial highlight the scoring can't capture.
  if (car.highlights[0]) reasons.push(car.highlights[0]);

  return reasons.slice(0, 4);
}

// ----- Public API -----

export interface RecommendResult {
  results: ScoredCar[];
  relaxedNote: string | null;
}

export function recommend(cars: Car[], prefs: Preferences, limit = 6): RecommendResult {
  const { matches, relaxedNote } = filterCars(cars, prefs);
  const weights = buildWeights(prefs.priorities, prefs.usage);
  const weightSum = Object.values(weights).reduce((a, b) => a + b, 0);

  const scored: ScoredCar[] = matches.map((car) => {
    const breakdown: Record<string, number> = {};
    let total = 0;
    (Object.keys(FACTORS) as Priority[]).forEach((factor) => {
      const s = Math.round(FACTORS[factor](car));
      breakdown[factor] = s;
      total += s * weights[factor];
    });
    const score = Math.round(total / weightSum);
    return {
      car,
      score,
      breakdown,
      reasons: buildReasons(car, prefs, breakdown),
      pitch: "", // filled in by the API (AI or template)
    };
  });

  scored.sort((a, b) => b.score - a.score || a.car.price - b.car.price);
  return { results: scored.slice(0, limit), relaxedNote };
}
