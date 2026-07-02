const LABELS: Record<string, string> = {
  knowledge: "Knowledge",
  skills: "Skills",
  human_development: "Human Development",
};
const SUB: Record<string, string> = {
  knowledge: "Savoir",
  skills: "Savoir-faire",
  human_development: "Savoir-être",
};
const CHIP: Record<string, string> = {
  knowledge: "bg-blue-50 text-blue-700",
  skills: "bg-emerald-50 text-emerald-700",
  human_development: "bg-purple-50 text-purple-700",
};

export function DimensionGauges({
  data,
}: {
  data: { dimension: string; score: number; pathCount: number }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.map((d) => (
        <div key={d.dimension} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-navy">{LABELS[d.dimension] ?? d.dimension}</span>
            <span className="text-xs uppercase tracking-wide text-ink/40">{SUB[d.dimension]}</span>
          </div>
          <div className="mt-3 text-3xl font-bold text-navy">
            {d.score}
            <span className="text-lg text-ink/40">%</span>
          </div>
          <div className="mt-2 h-2.5 w-full rounded-full bg-gray-100">
            <div
              className="h-2.5 rounded-full bg-gold transition-all"
              style={{ width: `${d.score}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-ink/50">
            {d.pathCount} path{d.pathCount === 1 ? "" : "s"}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DimensionChip({ dimension }: { dimension: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${CHIP[dimension] ?? "bg-gray-100 text-gray-600"}`}
    >
      {LABELS[dimension] ?? dimension}
    </span>
  );
}
