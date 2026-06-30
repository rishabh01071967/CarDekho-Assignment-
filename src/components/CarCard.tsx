"use client";

import { useEffect, useState } from "react";
import { Car, ScoredCar } from "@/lib/types";

const BAR_FACTORS: { key: string; label: string }[] = [
  { key: "safety", label: "Safety" },
  { key: "mileage", label: "Running cost" },
  { key: "space", label: "Space" },
];

// Wikimedia Commons full brand names give the best photo matches.
const MAKE_ALIASES: Record<string, string> = { Mercedes: "Mercedes-Benz" };

/**
 * Pulls a model-accurate photo from Wikimedia Commons — free, keyless, and
 * CORS-enabled. Falls back to a branded tile when there's no match.
 */
function CarPhoto({ car }: { car: Car }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const make = MAKE_ALIASES[car.make] ?? car.make;
    const search = encodeURIComponent(`${make} ${car.model}`);
    const url =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*" +
      "&generator=search&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=640" +
      `&gsrsearch=${search}`;

    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const pages = j?.query?.pages;
        const first = pages && (Object.values(pages)[0] as any);
        const thumb = first?.imageinfo?.[0]?.thumburl;
        if (live && thumb) setSrc(thumb);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [car.make, car.model]);

  return (
    <div className="car-photo">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={`${car.make} ${car.model}`} />
      ) : (
        <span className="car-photo-fallback">
          {car.make} {car.model}
        </span>
      )}
    </div>
  );
}

export default function CarCard({
  item,
  rank,
  selected,
  onToggleCompare,
}: {
  item: ScoredCar;
  rank: number;
  selected: boolean;
  onToggleCompare: (id: string) => void;
}) {
  const { car, score, breakdown, reasons, pitch } = item;

  return (
    <div className="panel car">
      <div className={`rank-badge ${rank === 1 ? "gold" : ""}`}>
        <small>Match</small>
        <b>{score}%</b>
      </div>

      <div className="car-main">
        <CarPhoto car={car} />
        <h3>
          {car.make} {car.model}
        </h3>
        <div className="variant">
          {car.variant} · {car.bodyType}
        </div>

        {pitch && <div className="pitch">{pitch}</div>}

        <ul className="reasons">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>

        <div className="spec-row">
          <span className="spec">{car.fuel}</span>
          <span className="spec">{car.transmission}</span>
          <span className="spec">{car.mileage}{car.fuel === "Electric" ? " km" : car.fuel === "CNG" ? " km/kg" : " kmpl"}</span>
          <span className="spec">{car.seating} seats</span>
          <span className="spec">{car.safetyRating ? `${car.safetyRating}★ NCAP` : "NCAP untested"}</span>
          <span className="spec">{car.powerBhp} bhp</span>
        </div>
      </div>

      <div className="car-side">
        <div className="price-tag">
          ₹{car.price}L
          <small>ex-showroom</small>
        </div>

        <div className="bars">
          {BAR_FACTORS.map((f) => (
            <div className="bar" key={f.key}>
              {f.label}
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${breakdown[f.key] ?? 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        <label className="compare-check">
          <input type="checkbox" checked={selected} onChange={() => onToggleCompare(car.id)} />
          Compare
        </label>
      </div>
    </div>
  );
}
