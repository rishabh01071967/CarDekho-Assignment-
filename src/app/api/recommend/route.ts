import { NextResponse } from "next/server";
import { CARS } from "@/data/cars";
import { recommend } from "@/lib/scoring";
import { attachPitches } from "@/lib/explain";
import { BodyType, Fuel, Preferences, Priority, Transmission, Usage } from "@/lib/types";

const PRIORITIES: Priority[] = ["safety", "mileage", "performance", "space", "value"];
const USAGES: Usage[] = ["city", "highway", "family", "mixed"];
const BODY_TYPES: BodyType[] = ["Hatchback", "Sedan", "Compact SUV", "SUV", "MPV"];
const FUELS: Fuel[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

/** Coerce arbitrary JSON into a safe Preferences object with sane defaults. */
function parsePreferences(body: any): Preferences {
  const num = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : fallback;

  const budgetMin = Math.max(0, num(body?.budgetMin, 5));
  const budgetMax = Math.max(budgetMin + 1, num(body?.budgetMax, 15));

  const filterList = <T,>(input: unknown, allowed: T[]): T[] =>
    Array.isArray(input) ? input.filter((x): x is T => allowed.includes(x as T)) : [];

  const transmission: Transmission | "Any" =
    body?.transmission === "Manual" || body?.transmission === "Automatic"
      ? body.transmission
      : "Any";

  const priorities = filterList<Priority>(body?.priorities, PRIORITIES);
  const usage: Usage = USAGES.includes(body?.usage) ? body.usage : "mixed";

  const makes = Array.isArray(body?.makes)
    ? body.makes.filter((m: unknown): m is string => typeof m === "string" && m.trim().length > 0).slice(0, 6)
    : [];

  return {
    budgetMin,
    budgetMax,
    bodyTypes: filterList<BodyType>(body?.bodyTypes, BODY_TYPES),
    fuels: filterList<Fuel>(body?.fuels, FUELS),
    transmission,
    seating: Math.max(2, num(body?.seating, 5)),
    priorities: priorities.length ? priorities : ["value"],
    usage,
    makes,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prefs = parsePreferences(body);
  const { results, relaxedNote } = recommend(CARS, prefs);

  if (results.length === 0) {
    return NextResponse.json({ results: [], relaxedNote, usedAI: false });
  }

  const { scored, usedAI } = await attachPitches(prefs, results);
  return NextResponse.json({ results: scored, relaxedNote, usedAI });
}
