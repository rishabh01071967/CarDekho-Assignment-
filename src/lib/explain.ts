import { Preferences, ScoredCar } from "./types";

/**
 * Turns a ranked car into a short, buyer-facing pitch.
 *
 * If ANTHROPIC_API_KEY is set we ask Claude to write all the pitches in one
 * batched call (fast + cheap). If the key is missing or the call fails for any
 * reason, we fall back to a deterministic template built from the same reasons,
 * so the product is fully functional with zero external dependencies.
 */

const MODEL = "claude-haiku-4-5-20251001";

function templatePitch(sc: ScoredCar): string {
  const lead = sc.reasons.slice(0, 2).join(". ");
  return `A ${sc.score}% match. ${lead}.`;
}

function buildTemplatePitches(scored: ScoredCar[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const sc of scored) out[sc.car.id] = templatePitch(sc);
  return out;
}

interface ClaudeResponse {
  content?: { type: string; text?: string }[];
}

async function fetchClaudePitches(
  prefs: Preferences,
  scored: ScoredCar[],
  apiKey: string,
): Promise<Record<string, string>> {
  const carLines = scored.map((sc) => ({
    id: sc.car.id,
    name: `${sc.car.make} ${sc.car.model} ${sc.car.variant}`,
    price: `₹${sc.car.price}L`,
    matchScore: sc.score,
    fuel: sc.car.fuel,
    bodyType: sc.car.bodyType,
    seating: sc.car.seating,
    safety: sc.car.safetyRating ? `${sc.car.safetyRating}-star NCAP` : "untested",
    mileage: sc.car.mileage,
    whyItMatched: sc.reasons,
  }));

  const system =
    "You are a friendly, no-nonsense car advisor for Indian buyers on a research " +
    "platform. For each car, write ONE punchy sentence (max 24 words) telling THIS " +
    "buyer why it suits them, grounded only in the data given. No hype, no inventing " +
    "specs. Speak to their stated priorities and usage. Return STRICT JSON only: " +
    '{"pitches":[{"id":"<id>","pitch":"<sentence>"}]}.';

  const user = JSON.stringify({
    buyer: {
      budget: `₹${prefs.budgetMin}-${prefs.budgetMax}L`,
      usage: prefs.usage,
      priorities: prefs.priorities,
      seating: prefs.seating,
    },
    cars: carLines,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

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
        max_tokens: 1024,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Anthropic API ${res.status}`);

    const data = (await res.json()) as ClaudeResponse;
    const text = data.content?.find((b) => b.type === "text")?.text ?? "";
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));

    const out: Record<string, string> = {};
    for (const p of json.pitches ?? []) {
      if (p?.id && typeof p.pitch === "string") out[p.id] = p.pitch.trim();
    }
    if (Object.keys(out).length === 0) throw new Error("Empty pitches");
    return out;
  } finally {
    clearTimeout(timeout);
  }
}

export async function attachPitches(
  prefs: Preferences,
  scored: ScoredCar[],
): Promise<{ scored: ScoredCar[]; usedAI: boolean }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = buildTemplatePitches(scored);

  let pitches = fallback;
  let usedAI = false;

  if (apiKey) {
    try {
      const ai = await fetchClaudePitches(prefs, scored, apiKey);
      // Use AI where we got it, template anywhere it's missing.
      pitches = { ...fallback, ...ai };
      usedAI = true;
    } catch {
      pitches = fallback;
      usedAI = false;
    }
  }

  return {
    scored: scored.map((sc) => ({ ...sc, pitch: pitches[sc.car.id] ?? templatePitch(sc) })),
    usedAI,
  };
}
