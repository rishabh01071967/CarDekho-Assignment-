import { NextResponse } from "next/server";
import { parseQuery } from "@/lib/parseQuery";
import {
  BodyType,
  Fuel,
  Preferences,
  Priority,
  Transmission,
  Usage,
} from "@/lib/types";

/**
 * Natural-language → Preferences using Claude.
 *
 * The client posts the raw search string; we ask Claude to turn it into the
 * same structured Preferences the scoring engine consumes. If ANTHROPIC_API_KEY
 * is missing or the call fails, we fall back to the offline regex parser in
 * parseQuery() so the search bar always returns *something* instantly.
 */

const MODEL = "claude-haiku-4-5-20251001";

const PRIORITIES: Priority[] = ["safety", "mileage", "performance", "space", "value"];
const USAGES: Usage[] = ["city", "highway", "family", "mixed"];
const BODY_TYPES: BodyType[] = ["Hatchback", "Sedan", "Compact SUV", "SUV", "MPV"];
const FUELS: Fuel[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];

const PRIORITY_LABEL: Record<Priority, string> = {
  safety: "Top safety",
  mileage: "High mileage",
  performance: "Performance",
  space: "Space & seats",
  value: "Value",
};

const SYSTEM = `You convert an Indian car-shopper's plain-English request into a strict JSON search filter.
Return ONLY this JSON, nothing else:
{
  "budgetMin": <number, lakhs INR, 0 if unspecified>,
  "budgetMax": <number, lakhs INR, 200 if unspecified>,
  "bodyTypes": <subset of ["Hatchback","Sedan","Compact SUV","SUV","MPV"]>,
  "fuels": <subset of ["Petrol","Diesel","CNG","Hybrid","Electric"]>,
  "transmission": <"Manual" | "Automatic" | "Any">,
  "seating": <number of seats needed, 5 if unspecified>,
  "priorities": <ordered subset of ["safety","mileage","performance","space","value"], most important first, max 3>,
  "usage": <"city" | "highway" | "family" | "mixed">,
  "makes": <array of brand or model name strings the user named, e.g. ["BMW"] or ["Creta"], [] if none>
}
Rules: 1 lakh = 100,000. "10L"/"10 lakh" = 10. "1 crore" = 100. If they name a luxury brand (BMW, Mercedes, Audi, Volvo, Lexus, Jaguar, Land Rover, Mini, BYD) and give no budget, set budgetMax to 200. Map "cheap to run"/"low running cost" to mileage priority. Map "fast"/"powerful" to performance. Never invent constraints the user didn't imply.`;

interface ClaudeResponse {
  content?: { type: string; text?: string }[];
}

function clampNum(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function coerce(raw: any): Preferences {
  const inList = <T,>(input: unknown, allowed: T[]): T[] =>
    Array.isArray(input) ? input.filter((x): x is T => allowed.includes(x as T)) : [];

  const budgetMin = Math.max(0, clampNum(raw?.budgetMin, 0));
  const budgetMax = Math.max(budgetMin + 1, clampNum(raw?.budgetMax, 30));
  const transmission: Transmission | "Any" =
    raw?.transmission === "Manual" || raw?.transmission === "Automatic"
      ? raw.transmission
      : "Any";

  const makes = Array.isArray(raw?.makes)
    ? raw.makes
        .filter((m: unknown): m is string => typeof m === "string" && m.trim().length > 0)
        .map((m: string) => m.trim())
        .slice(0, 6)
    : [];

  return {
    budgetMin,
    budgetMax,
    bodyTypes: inList<BodyType>(raw?.bodyTypes, BODY_TYPES),
    fuels: inList<Fuel>(raw?.fuels, FUELS),
    transmission,
    seating: Math.max(2, clampNum(raw?.seating, 5)),
    priorities: inList<Priority>(raw?.priorities, PRIORITIES).slice(0, 3),
    usage: USAGES.includes(raw?.usage) ? raw.usage : "mixed",
    makes,
  };
}

/** Build the human-readable "we understood" pills from a Preferences object. */
function chipsFor(p: Preferences): string[] {
  const chips: string[] = [];
  for (const m of p.makes) chips.push(m);
  if (p.budgetMin > 0 && p.budgetMax < 200) chips.push(`₹${p.budgetMin}–${p.budgetMax}L`);
  else if (p.budgetMax < 200) chips.push(`Under ₹${p.budgetMax}L`);
  if (p.seating !== 5) chips.push(`${p.seating} seats`);
  for (const b of p.bodyTypes) chips.push(b);
  for (const f of p.fuels) chips.push(f);
  if (p.transmission !== "Any") chips.push(p.transmission);
  for (const pr of p.priorities) chips.push(PRIORITY_LABEL[pr]);
  return chips;
}

async function claudeParse(query: string, apiKey: string): Promise<Preferences> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        system: SYSTEM,
        messages: [{ role: "user", content: query }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
    const data = (await res.json()) as ClaudeResponse;
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    return coerce(json);
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: Request) {
  let query = "";
  try {
    const body = await req.json();
    query = typeof body?.query === "string" ? body.query : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!query.trim()) {
    const empty = parseQuery("");
    return NextResponse.json({ prefs: empty.prefs, chips: empty.chips, usedAI: false });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const prefs = await claudeParse(query, apiKey);
      return NextResponse.json({ prefs, chips: chipsFor(prefs), usedAI: true });
    } catch {
      // fall through to the offline parser
    }
  }

  const { prefs, chips } = parseQuery(query);
  return NextResponse.json({ prefs, chips, usedAI: false });
}
