import { BodyType, Fuel, Preferences, Priority, Transmission, Usage } from "@/lib/types";

/**
 * Turns a plain-English search ("7-seater under ₹15L with good mileage")
 * into the same `Preferences` object the quiz produces, so the existing
 * scoring engine can rank cars with zero changes. It's deliberately a
 * lightweight heuristic parser — no API call — so the typeahead stays instant.
 */

export interface ParsedQuery {
  prefs: Preferences;
  /** Human-readable pills shown in the "We understood" row. */
  chips: string[];
}

const DEFAULTS: Preferences = {
  budgetMin: 0,
  budgetMax: 30,
  bodyTypes: [],
  fuels: [],
  transmission: "Any",
  seating: 5,
  priorities: [],
  usage: "mixed",
  makes: [],
};

/** Known brands and popular model names the heuristic can pick out of free text. */
const KNOWN_KEYWORDS = [
  // brands
  "Maruti", "Suzuki", "Hyundai", "Tata", "Mahindra", "Kia", "Toyota", "Honda",
  "Skoda", "Volkswagen", "VW", "MG", "Renault", "Nissan", "Citroen", "Jeep",
  "BMW", "Mercedes", "Audi", "Volvo", "BYD", "Lexus", "Mini", "Jaguar", "Land Rover",
  // popular models
  "Nexon", "Creta", "Seltos", "Brezza", "Venue", "Sonet", "Punch", "Harrier",
  "Safari", "Scorpio", "Thar", "XUV700", "XUV300", "Fronx", "Baleno", "Swift",
  "Dzire", "Verna", "Amaze", "Virtus", "Slavia", "Kushaq", "Taigun",
  "Hector", "Astor", "Ertiga", "Carens", "Innova", "Hyryder", "Grand Vitara",
  "Alto", "Tiago", "Tigor", "Altroz", "i20", "Magnite", "Kiger", "Curvv",
];

const PRIORITY_LABEL: Record<Priority, string> = {
  safety: "Top safety",
  mileage: "High mileage",
  performance: "Performance",
  space: "Space & seats",
  value: "Value",
};

export function parseQuery(raw: string): ParsedQuery {
  const q = raw.toLowerCase();
  const prefs: Preferences = { ...DEFAULTS, bodyTypes: [], fuels: [], priorities: [], makes: [] };
  const chips: string[] = [];

  // ---- Brand / model ---------------------------------------------------
  for (const kw of KNOWN_KEYWORDS) {
    const re = new RegExp(`\\b${kw.toLowerCase().replace(/[-/]/g, "\\$&")}\\b`);
    if (re.test(q) && !prefs.makes.includes(kw)) {
      prefs.makes.push(kw);
      chips.push(kw);
    }
  }

  // ---- Budget ----------------------------------------------------------
  const range = q.match(/₹?\s*(\d+)\s*(?:l|lakh)?\s*(?:-|–|to)\s*₹?\s*(\d+)\s*(?:l|lakh)/);
  const under = q.match(/(?:under|below|upto|up to|less than|within)\s*₹?\s*(\d+)\s*(?:l|lakh)?/);
  if (range) {
    prefs.budgetMin = Number(range[1]);
    prefs.budgetMax = Number(range[2]);
    chips.push(`₹${prefs.budgetMin}–${prefs.budgetMax}L`);
  } else if (under) {
    prefs.budgetMax = Number(under[1]);
    chips.push(`Under ₹${prefs.budgetMax}L`);
  }

  // ---- Seating ---------------------------------------------------------
  const seats = q.match(/(\d+)\s*(?:-|\s)?\s*seat/);
  if (seats) {
    prefs.seating = Number(seats[1]);
    chips.push(`${prefs.seating} seats`);
  }

  // ---- Body type -------------------------------------------------------
  const bodyMap: [RegExp, BodyType][] = [
    [/compact suv|sub-?compact/, "Compact SUV"],
    [/\bsuv\b/, "SUV"],
    [/hatch(back)?/, "Hatchback"],
    [/sedan/, "Sedan"],
    [/\bmpv\b|people mover/, "MPV"],
  ];
  for (const [re, body] of bodyMap) {
    if (re.test(q) && !prefs.bodyTypes.includes(body)) {
      prefs.bodyTypes.push(body);
      chips.push(body);
    }
  }

  // ---- Fuel ------------------------------------------------------------
  const fuelMap: [RegExp, Fuel][] = [
    [/petrol/, "Petrol"],
    [/diesel/, "Diesel"],
    [/\bcng\b/, "CNG"],
    [/hybrid/, "Hybrid"],
    [/electric|\bev\b/, "Electric"],
  ];
  for (const [re, fuel] of fuelMap) {
    if (re.test(q) && !prefs.fuels.includes(fuel)) {
      prefs.fuels.push(fuel);
      chips.push(fuel);
    }
  }

  // ---- Transmission ----------------------------------------------------
  if (/automatic|\bauto\b|amt|cvt|dct/.test(q)) {
    prefs.transmission = "Automatic" as Transmission;
    chips.push("Automatic");
  } else if (/manual|stick/.test(q)) {
    prefs.transmission = "Manual" as Transmission;
    chips.push("Manual");
  }

  // ---- Priorities ------------------------------------------------------
  const prioMap: [RegExp, Priority][] = [
    [/safe|safety|ncap|airbag/, "safety"],
    [/mileage|efficien|economical|cheap to run|low running|fuel cost/, "mileage"],
    [/fast|power|performance|punchy|sporty|quick/, "performance"],
    [/space|spacious|roomy|boot|luggage|family/, "space"],
    [/value|budget|affordable|resale|worth/, "value"],
  ];
  for (const [re, prio] of prioMap) {
    if (re.test(q) && !prefs.priorities.includes(prio) && prefs.priorities.length < 3) {
      prefs.priorities.push(prio);
      chips.push(PRIORITY_LABEL[prio]);
    }
  }

  // ---- Usage -----------------------------------------------------------
  if (/city|commut|traffic|urban/.test(q)) prefs.usage = "city" as Usage;
  else if (/highway|long drive|road trip|expressway/.test(q)) prefs.usage = "highway" as Usage;
  else if (/family|kids|school/.test(q)) prefs.usage = "family" as Usage;

  // A named brand with no stated budget shouldn't be capped by the default —
  // open the ceiling so premium marques (BMW, Mercedes…) can surface.
  if (prefs.makes.length > 0 && !range && !under) prefs.budgetMax = 200;

  return { prefs, chips };
}
