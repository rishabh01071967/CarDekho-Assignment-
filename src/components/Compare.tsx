"use client";

import { ScoredCar } from "@/lib/types";

interface Row {
  label: string;
  get: (s: ScoredCar) => string;
  /** Returns the index of the "best" car for this row, or -1 to skip highlighting. */
  best?: (items: ScoredCar[]) => number;
}

const argbest = (items: ScoredCar[], val: (s: ScoredCar) => number, dir: 1 | -1) => {
  let idx = 0;
  let cur = val(items[0]);
  items.forEach((s, i) => {
    const v = val(s);
    if (dir === 1 ? v > cur : v < cur) {
      cur = v;
      idx = i;
    }
  });
  return idx;
};

const ROWS: Row[] = [
  { label: "Match score", get: (s) => `${s.score}%`, best: (i) => argbest(i, (s) => s.score, 1) },
  { label: "Price", get: (s) => `₹${s.car.price}L`, best: (i) => argbest(i, (s) => s.car.price, -1) },
  { label: "Body type", get: (s) => s.car.bodyType },
  { label: "Fuel", get: (s) => s.car.fuel },
  { label: "Transmission", get: (s) => s.car.transmission },
  {
    label: "Mileage / range",
    get: (s) =>
      `${s.car.mileage}${
        s.car.fuel === "Electric" ? " km" : s.car.fuel === "CNG" ? " km/kg" : " kmpl"
      }`,
  },
  { label: "Seating", get: (s) => `${s.car.seating}`, best: (i) => argbest(i, (s) => s.car.seating, 1) },
  {
    label: "Boot space",
    get: (s) => `${s.car.bootSpace} L`,
    best: (i) => argbest(i, (s) => s.car.bootSpace, 1),
  },
  {
    label: "Safety (NCAP)",
    get: (s) => (s.car.safetyRating ? `${s.car.safetyRating}★` : "Untested"),
    best: (i) => argbest(i, (s) => s.car.safetyRating, 1),
  },
  { label: "Power", get: (s) => `${s.car.powerBhp} bhp`, best: (i) => argbest(i, (s) => s.car.powerBhp, 1) },
];

export default function Compare({
  items,
  onClose,
}: {
  items: ScoredCar[];
  onClose: () => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Side-by-side comparison</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="cmp-table">
            <thead>
              <tr>
                <th>Spec</th>
                {items.map((s) => (
                  <th key={s.car.id}>
                    {s.car.make} {s.car.model}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                const bestIdx = row.best ? row.best(items) : -1;
                return (
                  <tr key={row.label}>
                    <th>{row.label}</th>
                    {items.map((s, i) => (
                      <td key={s.car.id} className={i === bestIdx && items.length > 1 ? "best" : ""}>
                        {row.get(s)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
