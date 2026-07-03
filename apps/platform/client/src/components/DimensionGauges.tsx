import { Brain, HeartHandshake, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, ProgressBar } from "./ui";

const META = {
  knowledge: {
    label: "Knowledge",
    sub: "Savoir",
    icon: Brain,
    bar: "bg-dim-knowledge",
    tile: "bg-dim-knowledge/10 text-dim-knowledge",
  },
  skills: {
    label: "Skills",
    sub: "Savoir-faire",
    icon: Wrench,
    bar: "bg-dim-skills",
    tile: "bg-dim-skills/10 text-dim-skills",
  },
  human_development: {
    label: "Human Development",
    sub: "Savoir-être",
    icon: HeartHandshake,
    bar: "bg-dim-human",
    tile: "bg-dim-human/10 text-dim-human",
  },
} satisfies Record<string, { label: string; sub: string; icon: LucideIcon; bar: string; tile: string }>;

function metaFor(dimension: string) {
  return META[dimension as keyof typeof META] ?? META.knowledge;
}

export function DimensionGauges({
  data,
}: {
  data: { dimension: string; score: number; pathCount: number }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.map((d) => {
        const m = metaFor(d.dimension);
        const Icon = m.icon;
        return (
          <Card key={d.dimension} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${m.tile}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="font-semibold text-navy-900">{m.label}</div>
                <div className="text-[11px] uppercase tracking-wide text-ink/40">{m.sub}</div>
              </div>
            </div>
            <div className="mt-4 flex items-end justify-between">
              <span className="text-3xl font-bold text-navy-900">
                {d.score}
                <span className="text-lg text-ink/40">%</span>
              </span>
              <span className="text-xs text-ink/45">
                {d.pathCount} path{d.pathCount === 1 ? "" : "s"}
              </span>
            </div>
            <ProgressBar value={d.score} className="mt-3" barClassName={m.bar} />
          </Card>
        );
      })}
    </div>
  );
}

export function DimensionChip({ dimension }: { dimension: string }) {
  const m = metaFor(dimension);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${m.tile}`}
    >
      {m.label}
    </span>
  );
}
