import { useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  ProgressBar,
  Spinner,
  TextInput,
  cn,
} from "../components/ui";

const ALL_DIMENSIONS = [
  { key: "knowledge", label: "Knowledge" },
  { key: "skills", label: "Skills" },
  { key: "human_development", label: "Human Development" },
] as const;

type Dim = (typeof ALL_DIMENSIONS)[number]["key"];

function dueLabel(dueAt: string | Date | null | undefined) {
  if (!dueAt) return null;
  return new Date(dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function Paths() {
  const me = trpc.auth.me.useQuery();
  const paths = trpc.paths.list.useQuery();
  const assigned = trpc.paths.assigned.useQuery();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [dims, setDims] = useState<Dim[]>([]);

  const create = trpc.paths.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setDims([]);
      await utils.paths.list.invalidate();
      await utils.paths.progression.invalidate();
    },
  });

  const toggle = (d: Dim) =>
    setDims((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));

  // A plain learner in an org sees only what's assigned to them and can't author paths.
  const isTeamLearner =
    me.data?.activeOrganization?.type === "team" &&
    me.data?.activeOrganization?.role === "member";

  const list = (isTeamLearner ? (assigned.data ?? []) : (paths.data ?? [])).map((p) => ({
    id: p.id,
    title: p.title,
    progress: p.progress,
    completedCount: p.completedCount,
    itemCount: p.itemCount,
    dimensions: p.dimensions,
    dueAt: (p as { dueAt?: string | Date | null }).dueAt ?? null,
  }));
  const loading = isTeamLearner ? assigned.isLoading : paths.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeamLearner ? "My learning paths" : "Learning paths"}
        subtitle={
          isTeamLearner
            ? "Paths assigned to you by your mentor."
            : "Guided sequences that grow the three dimensions."
        }
      />

      {!isTeamLearner && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-semibold text-navy-900">Create a path</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim()) create.mutate({ title: title.trim(), dimensions: dims });
            }}
            className="space-y-4"
          >
            <TextInput
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Path title (e.g. Junior Developer Training)"
            />
            <div className="flex flex-wrap gap-2">
              {ALL_DIMENSIONS.map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => toggle(d.key)}
                  className={cn(
                    "rounded-full border px-3.5 py-1.5 text-sm font-medium transition",
                    dims.includes(d.key)
                      ? "border-navy-900 bg-navy-900 text-white"
                      : "border-gray-200 text-ink/70 hover:border-navy/40",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create path"}
            </Button>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner label="Loading…" />
      ) : list.length > 0 ? (
        <div className="space-y-3">
          {list.map((p) => (
            <Link key={p.id} to={`/paths/${p.id}`}>
              <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold text-navy-900">{p.title}</span>
                    {dueLabel(p.dueAt) && (
                      <span className="rounded-full bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold">
                        Due {dueLabel(p.dueAt)}
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-ink/50">
                    {p.completedCount}/{p.itemCount} done
                  </span>
                </div>
                {p.dimensions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.dimensions.map((d) => (
                      <DimensionChip key={d} dimension={d} />
                    ))}
                  </div>
                )}
                <ProgressBar value={p.progress} className="mt-3" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={RouteIcon}
          title={isTeamLearner ? "No paths assigned yet" : "No paths yet"}
          description={
            isTeamLearner
              ? "Your mentor will assign learning paths for you here."
              : "Create your first learning path above to start tracking progress."
          }
        />
      )}
    </div>
  );
}
