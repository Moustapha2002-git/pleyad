/**
 * Dimension milestones — the payoff for the 3-D gauges. A learner earns a tier as a
 * dimension score crosses 25 / 50 / 75 / 100. Derived purely from the current score,
 * so there's nothing to store or keep in sync.
 */
export type Tier = { key: string; label: string; pill: string; min: number };

const TIERS: Tier[] = [
  { key: "master", label: "Master", pill: "bg-gold/20 text-gold", min: 100 },
  { key: "gold", label: "Gold", pill: "bg-amber-400/25 text-amber-700", min: 75 },
  { key: "silver", label: "Silver", pill: "bg-slate-300/50 text-slate-700", min: 50 },
  { key: "bronze", label: "Bronze", pill: "bg-orange-500/15 text-orange-700", min: 25 },
];

/** Highest tier earned at this score, or null below the first threshold. */
export function tierFor(score: number): Tier | null {
  return TIERS.find((t) => score >= t.min) ?? null;
}

/** The next threshold to aim for, or null once at 100. */
export function nextTierAt(score: number): number | null {
  return [25, 50, 75, 100].find((m) => score < m) ?? null;
}
