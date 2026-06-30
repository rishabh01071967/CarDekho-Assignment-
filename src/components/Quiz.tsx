"use client";

import { useState } from "react";
import { BodyType, Fuel, Preferences, Priority, Transmission, Usage } from "@/lib/types";

const USAGE_OPTS: { value: Usage; label: string; emoji: string }[] = [
  { value: "city", label: "Mostly city", emoji: "🏙️" },
  { value: "highway", label: "Lots of highway", emoji: "🛣️" },
  { value: "family", label: "Family duties", emoji: "👨‍👩‍👧" },
  { value: "mixed", label: "A bit of everything", emoji: "🔀" },
];

const BODY_OPTS: BodyType[] = ["Hatchback", "Sedan", "Compact SUV", "SUV", "MPV"];
const FUEL_OPTS: Fuel[] = ["Petrol", "Diesel", "CNG", "Hybrid", "Electric"];
const TRANS_OPTS: (Transmission | "Any")[] = ["Any", "Manual", "Automatic"];

const PRIORITY_OPTS: { value: Priority; label: string; emoji: string }[] = [
  { value: "safety", label: "Safety", emoji: "🛡️" },
  { value: "mileage", label: "Low running cost", emoji: "⛽" },
  { value: "performance", label: "Performance", emoji: "⚡" },
  { value: "space", label: "Space & seats", emoji: "🧳" },
  { value: "value", label: "Value for money", emoji: "💰" },
];

const BUDGET_PRESETS: { label: string; min: number; max: number }[] = [
  { label: "Under ₹7L", min: 0, max: 7 },
  { label: "₹7L–12L", min: 7, max: 12 },
  { label: "₹12L–18L", min: 12, max: 18 },
  { label: "₹18L+", min: 18, max: 30 },
];

const STEPS = 4;

export default function Quiz({ onSubmit }: { onSubmit: (p: Preferences) => void }) {
  const [step, setStep] = useState(0);
  const [budgetMin, setBudgetMin] = useState(7);
  const [budgetMax, setBudgetMax] = useState(12);
  const [usage, setUsage] = useState<Usage>("mixed");
  const [bodyTypes, setBodyTypes] = useState<BodyType[]>([]);
  const [seating, setSeating] = useState(5);
  const [fuels, setFuels] = useState<Fuel[]>([]);
  const [transmission, setTransmission] = useState<Transmission | "Any">("Any");
  const [priorities, setPriorities] = useState<Priority[]>([]);

  const toggle = <T,>(list: T[], val: T, set: (v: T[]) => void) =>
    set(list.includes(val) ? list.filter((x) => x !== val) : [...list, val]);

  const togglePriority = (p: Priority) => {
    if (priorities.includes(p)) {
      setPriorities(priorities.filter((x) => x !== p));
    } else if (priorities.length < 3) {
      setPriorities([...priorities, p]);
    }
  };

  const submit = () =>
    onSubmit({
      budgetMin,
      budgetMax,
      bodyTypes,
      fuels,
      transmission,
      seating,
      priorities: priorities.length ? priorities : ["value"],
      usage,
      makes: [],
    });

  const canProceed = step < 3 || priorities.length > 0;

  return (
    <div className="panel quiz">
      <div className="progress">
        {Array.from({ length: STEPS }).map((_, i) => (
          <span key={i} className={i <= step ? "on" : ""} />
        ))}
      </div>

      {step === 0 && (
        <>
          <div className="step-kicker">Step 1 of {STEPS}</div>
          <h2 className="step-title">What&apos;s your budget, and how will you drive?</h2>
          <p className="step-sub">Ex-showroom price. We&apos;ll allow a little wiggle room.</p>

          <div className="field">
            <label>Budget range</label>
            <div className="budget-presets">
              {BUDGET_PRESETS.map((b) => (
                <div
                  key={b.label}
                  className={`preset ${budgetMin === b.min && budgetMax === b.max ? "sel" : ""}`}
                  onClick={() => {
                    setBudgetMin(b.min);
                    setBudgetMax(b.max);
                  }}
                >
                  {b.label}
                </div>
              ))}
            </div>
            <div className="range-row">
              <span style={{ fontSize: 13, color: "var(--slate)" }}>Max</span>
              <input
                type="range"
                min={4}
                max={30}
                step={1}
                value={budgetMax}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setBudgetMax(v);
                  if (v <= budgetMin) setBudgetMin(Math.max(0, v - 3));
                }}
              />
              <span className="range-val">₹{budgetMax}L</span>
            </div>
          </div>

          <div className="field">
            <label>How will you mostly use it?</label>
            <div className="chips">
              {USAGE_OPTS.map((u) => (
                <div
                  key={u.value}
                  className={`chip ${usage === u.value ? "sel" : ""}`}
                  onClick={() => setUsage(u.value)}
                >
                  {u.emoji} {u.label}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="step-kicker">Step 2 of {STEPS}</div>
          <h2 className="step-title">Any body style in mind?</h2>
          <p className="step-sub">Pick any that appeal — or none, and we&apos;ll keep it open.</p>

          <div className="field">
            <label>Body type</label>
            <div className="chips">
              {BODY_OPTS.map((b) => (
                <div
                  key={b}
                  className={`chip ${bodyTypes.includes(b) ? "sel" : ""}`}
                  onClick={() => toggle(bodyTypes, b, setBodyTypes)}
                >
                  {b}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Minimum seats</label>
            <div className="stepper">
              <button onClick={() => setSeating(Math.max(2, seating - 1))}>−</button>
              <span>{seating}</span>
              <button onClick={() => setSeating(Math.min(8, seating + 1))}>+</button>
            </div>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="step-kicker">Step 3 of {STEPS}</div>
          <h2 className="step-title">Fuel and gearbox preference?</h2>
          <p className="step-sub">Leave fuel open if you&apos;re not sure — we&apos;ll suggest the smart options.</p>

          <div className="field">
            <label>Fuel type</label>
            <div className="chips">
              {FUEL_OPTS.map((f) => (
                <div
                  key={f}
                  className={`chip ${fuels.includes(f) ? "sel" : ""}`}
                  onClick={() => toggle(fuels, f, setFuels)}
                >
                  {f}
                </div>
              ))}
            </div>
          </div>

          <div className="field">
            <label>Transmission</label>
            <div className="chips">
              {TRANS_OPTS.map((t) => (
                <div
                  key={t}
                  className={`chip ${transmission === t ? "sel" : ""}`}
                  onClick={() => setTransmission(t)}
                >
                  {t}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="step-kicker">Step 4 of {STEPS}</div>
          <h2 className="step-title">What matters most to you?</h2>
          <p className="step-sub">Pick up to 3, in order. Your #1 drives the ranking hardest.</p>

          <div className="field">
            <label>Your priorities {priorities.length > 0 && `(${priorities.length}/3)`}</label>
            <div className="chips">
              {PRIORITY_OPTS.map((p) => {
                const rank = priorities.indexOf(p.value);
                return (
                  <div
                    key={p.value}
                    className={`chip ${rank >= 0 ? "sel" : ""}`}
                    onClick={() => togglePriority(p.value)}
                  >
                    {rank >= 0 && <span className="rank">{rank + 1}</span>}
                    {p.emoji} {p.label}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="quiz-nav">
        {step > 0 ? (
          <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            ← Back
          </button>
        ) : (
          <span />
        )}
        {step < STEPS - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>
            Continue →
          </button>
        ) : (
          <button className="btn btn-primary" disabled={!canProceed} onClick={submit}>
            Show my shortlist →
          </button>
        )}
      </div>
    </div>
  );
}
