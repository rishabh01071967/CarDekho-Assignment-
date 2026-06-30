export type BodyType =
  | "Hatchback"
  | "Sedan"
  | "Compact SUV"
  | "SUV"
  | "MPV";

export type Fuel = "Petrol" | "Diesel" | "CNG" | "Hybrid" | "Electric";

export type Transmission = "Manual" | "Automatic";

export interface Car {
  id: string;
  make: string;
  model: string;
  variant: string;
  /** Ex-showroom price in INR lakhs */
  price: number;
  bodyType: BodyType;
  fuel: Fuel;
  transmission: Transmission;
  /** Claimed mileage in km/l (or km/charge equivalent for EV) */
  mileage: number;
  seating: number;
  /** Global NCAP safety rating, 0 if untested */
  safetyRating: number;
  bootSpace: number;
  powerBhp: number;
  /** Short editorial highlights */
  highlights: string[];
}

/** What the buyer tells us in the quiz */
export interface Preferences {
  budgetMin: number;
  budgetMax: number;
  bodyTypes: BodyType[];
  fuels: Fuel[];
  transmission: Transmission | "Any";
  seating: number;
  /** Brand / model keywords, e.g. ["BMW"] or ["Creta"]. Empty = any. */
  makes: string[];
  /** Buyer's ranked priorities, drives the scoring weights */
  priorities: Priority[];
  usage: Usage;
}

export type Priority =
  | "safety"
  | "mileage"
  | "performance"
  | "space"
  | "value";

export type Usage = "city" | "highway" | "family" | "mixed";

export interface ScoredCar {
  car: Car;
  score: number;
  /** Per-factor 0-100 breakdown, used for the match bars */
  breakdown: Record<string, number>;
  /** Human-readable reasons this car fits the buyer */
  reasons: string[];
  /** AI- or template-generated summary */
  pitch: string;
}
