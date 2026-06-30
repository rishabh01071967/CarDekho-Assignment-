"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Fuel, Preferences, Transmission } from "@/lib/types";
import { CARS } from "@/data/cars";
import { recommend } from "@/lib/scoring";
import { parseQuery } from "@/lib/parseQuery";

const EXAMPLES = [
  "First family car under ₹10L",
  "Cheapest to run, mostly city",
  "5-star safety automatic",
];

/** Rotating placeholders that cycle while the box is empty. */
const PLACEHOLDERS = [
  "First family car under ₹7 lakh",
  "Diesel SUV with 5-star safety, automatic",
  "BMW or Audi under ₹60 lakh",
  "Cheapest car to run, mostly city driving",
  "7-seater under ₹15L with good mileage",
  "Electric car with long range and a big boot",
  "Punchy automatic hatchback under ₹12L",
];

const FUEL_OPTS: Fuel[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
const TRANS_OPTS: Transmission[] = ["Automatic", "Manual"];

const TILE_BG = ["#fdeef1", "#eaf6ef", "#eef1fb", "#fff4e6"];
const TILE_FG = ["#c01d3c", "#1f9d62", "#3a52cc", "#a8631a"];

const EMPTY_PREFS = parseQuery("").prefs;

function fuelUnit(fuel: string) {
  if (fuel === "Electric") return " km";
  if (fuel === "CNG") return " km/kg";
  return " kmpl";
}

export default function AISearch({ onSubmit }: { onSubmit: (p: Preferences) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const [prefs, setPrefs] = useState<Preferences>(EMPTY_PREFS);
  const [chips, setChips] = useState<string[]>([]);
  const [usedAI, setUsedAI] = useState(false);
  const [parsing, setParsing] = useState(false);

  // --- typewriter placeholder (pauses once the user types) ---
  const [typed, setTyped] = useState("");
  useEffect(() => {
    if (query.length > 0) return;
    let phrase = 0;
    let pos = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const full = PLACEHOLDERS[phrase];
      if (!deleting) {
        pos += 1;
        setTyped(full.slice(0, pos));
        if (pos === full.length) {
          deleting = true;
          timer = setTimeout(tick, 1700); // hold the finished line
          return;
        }
        timer = setTimeout(tick, 55);
      } else {
        pos -= 1;
        setTyped(full.slice(0, pos));
        if (pos === 0) {
          deleting = false;
          phrase = (phrase + 1) % PLACEHOLDERS.length;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 28);
      }
    };

    timer = setTimeout(tick, 350);
    return () => clearTimeout(timer);
  }, [query.length]);

  // --- parse the query: instant offline guess, then refine with Claude ---
  const reqId = useRef(0);
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setPrefs(EMPTY_PREFS);
      setChips([]);
      setUsedAI(false);
      setParsing(false);
      return;
    }

    // Instant local heuristic so the panel never feels laggy.
    const local = parseQuery(q);
    setPrefs(local.prefs);
    setChips(local.chips);

    const id = ++reqId.current;
    setParsing(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/parse", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ query: q }),
          signal: ctrl.signal,
        });
        const j = await res.json();
        if (id === reqId.current && j?.prefs) {
          setPrefs(j.prefs);
          setChips(Array.isArray(j.chips) ? j.chips : []);
          setUsedAI(!!j.usedAI);
        }
      } catch {
        /* keep the local guess */
      } finally {
        if (id === reqId.current) setParsing(false);
      }
    }, 450);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const all = useMemo(() => recommend(CARS, prefs, 50).results, [prefs]);
  const top = all.slice(0, 3);

  // Nothing is forced on — these chips let the user steer fuel & gearbox.
  const toggleFuel = (f: Fuel) =>
    setPrefs((p) => ({
      ...p,
      fuels: p.fuels.includes(f) ? p.fuels.filter((x) => x !== f) : [...p.fuels, f],
    }));
  const toggleTrans = (t: Transmission) =>
    setPrefs((p) => ({ ...p, transmission: p.transmission === t ? "Any" : t }));

  const showPanel = open && query.trim().length > 0;

  return (
    <div className="ais">
      <div className="ais-badge">
        <Sparkle size={14} />
        AI-ASSISTED SEARCH
      </div>
      <h1 className="ais-title">
        Just describe the car
        <br />
        you&apos;re looking for
      </h1>
      <p className="ais-sub">
        Type it the way you&apos;d say it. Claude reads your budget, body type and priorities —
        then ranks every car for how you&apos;ll actually drive.
      </p>

      <div className="ais-examples">
        <span className="ais-try">Try:</span>
        {EXAMPLES.map((ex) => (
          <button key={ex} type="button" className="ais-chip" onClick={() => setQuery(ex)}>
            {ex}
          </button>
        ))}
      </div>

      <div className="ais-box-wrap">
        <form
          className="ais-box"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(prefs);
          }}
        >
          <Sparkle size={20} withTrail />
          <input
            className="ais-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={`${typed}▏`}
            aria-label="Describe the car you want"
          />
          <button type="submit" className="ais-ask">
            Ask AI
            <Arrow />
          </button>
        </form>

        {showPanel && (
          <div className="ais-panel">
            {chips.length > 0 && (
              <div className="ais-understood">
                <div className="ais-eyebrow">We understood your search</div>
                <div className="ais-pills">
                  {chips.map((c) => (
                    <span key={c} className="ais-pill">
                      <Check />
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="ais-refine">
              <span className="ais-refine-label">Fuel</span>
              {FUEL_OPTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`ais-toggle ${prefs.fuels.includes(f) ? "on" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleFuel(f)}
                >
                  {f}
                </button>
              ))}
              <span className="ais-refine-label" style={{ marginLeft: 6 }}>
                Gearbox
              </span>
              {TRANS_OPTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`ais-toggle ${prefs.transmission === t ? "on" : ""}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => toggleTrans(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="ais-matches">
              <div className="ais-eyebrow ais-eyebrow-pad">Top matches</div>
              {top.length === 0 && (
                <div className="ais-row-spec" style={{ padding: "8px 12px" }}>
                  No cars matched yet — keep typing.
                </div>
              )}
              {top.map((s, i) => (
                <button
                  key={s.car.id}
                  type="button"
                  className="ais-row"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onSubmit(prefs)}
                >
                  <span
                    className="ais-tile"
                    style={{ background: TILE_BG[i % 4], color: TILE_FG[i % 4] }}
                  >
                    {s.car.model.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="ais-row-main">
                    <span className="ais-row-name">
                      {s.car.make} {s.car.model} {s.car.variant}
                    </span>
                    <span className="ais-row-spec">
                      {s.car.bodyType} · {s.car.fuel} · {s.car.mileage}
                      {fuelUnit(s.car.fuel)} · ₹{s.car.price}L
                    </span>
                  </span>
                  <span className="ais-row-match">
                    <b style={{ color: s.score >= 85 ? "#1f9d62" : "#5a6473" }}>{s.score}%</b>
                    <small>match</small>
                  </span>
                </button>
              ))}
            </div>

            <div className="ais-foot">
              <span>
                Press <kbd>Enter</kbd> to see all {all.length} matches
              </span>
              <span className="ais-powered">
                <Sparkle size={13} />
                {parsing ? "Reading with Claude…" : usedAI ? "Parsed by Claude" : "Powered by Claude"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- inline icons (no dependencies) ---------- */

function Sparkle({ size = 16, withTrail = false }: { size?: number; withTrail?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.6L19.5 9l-5.7 1.4L12 16l-1.8-5.6L4.5 9l5.7-1.4L12 2z" />
      {withTrail && (
        <path opacity="0.5" d="M19 13l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 13z" />
      )}
    </svg>
  );
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
