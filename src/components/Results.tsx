"use client";

import { useState } from "react";
import { ScoredCar } from "@/lib/types";
import CarCard from "./CarCard";
import Compare from "./Compare";

export default function Results({
  results,
  relaxedNote,
  usedAI,
  onRestart,
}: {
  results: ScoredCar[];
  relaxedNote: string | null;
  usedAI: boolean;
  onRestart: () => void;
}) {
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);

  const toggleCompare = (id: string) =>
    setCompareIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < 3 ? [...ids, id] : ids,
    );

  const compareItems = results.filter((r) => compareIds.includes(r.car.id));

  return (
    <div className="wrap">
      <div className="results-head">
        <div>
          <h2>Your shortlist</h2>
          <p>
            {results.length} cars ranked for how you drive — best match first.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className={`ai-badge ${usedAI ? "on" : ""}`}>
            {usedAI ? "✨ AI-written picks" : "Rule-based picks"}
          </span>
          <button className="btn btn-ghost" onClick={onRestart}>
            ↺ Start over
          </button>
        </div>
      </div>

      {relaxedNote && <div className="relaxed-note">⚠️ {relaxedNote}</div>}

      <div className="card-list">
        {results.map((item, i) => (
          <CarCard
            key={item.car.id}
            item={item}
            rank={i + 1}
            selected={compareIds.includes(item.car.id)}
            onToggleCompare={toggleCompare}
          />
        ))}
      </div>

      {compareIds.length > 0 && (
        <div className="compare-bar">
          <span>{compareIds.length} selected to compare</span>
          <button
            className="btn btn-primary"
            disabled={compareIds.length < 2}
            onClick={() => setShowCompare(true)}
          >
            Compare
          </button>
          <button className="btn btn-ghost" style={{ color: "#fff" }} onClick={() => setCompareIds([])}>
            Clear
          </button>
        </div>
      )}

      {showCompare && <Compare items={compareItems} onClose={() => setShowCompare(false)} />}
    </div>
  );
}
