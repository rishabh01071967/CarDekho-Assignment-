"use client";

import { useState } from "react";
import { Preferences, ScoredCar } from "@/lib/types";
import Results from "@/components/Results";
import AISearch from "@/components/AISearch";

type Phase = "quiz" | "loading" | "results";

interface ApiResponse {
  results: ScoredCar[];
  relaxedNote: string | null;
  usedAI: boolean;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("quiz");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(prefs: Preferences) {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
      setPhase("results");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase("quiz");
    }
  }

  if (phase === "results" && data) {
    return (
      <main>
        <Results
          results={data.results}
          relaxedNote={data.relaxedNote}
          usedAI={data.usedAI}
          onRestart={() => {
            setData(null);
            setPhase("quiz");
          }}
        />
      </main>
    );
  }

  return (
    <main>
      <div className="wrap">
        <AISearch onSubmit={handleSubmit} />

        {error && (
          <div className="relaxed-note" style={{ background: "#fdecec", borderColor: "#f5c2c2", color: "#a12626" }}>
            {error}. Please try again.
          </div>
        )}

        {phase === "loading" && (
          <div className="loading">
            <div className="spinner" />
            Scoring cars against your preferences…
          </div>
        )}
      </div>
    </main>
  );
}
