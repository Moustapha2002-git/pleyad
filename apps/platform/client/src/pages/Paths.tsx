import { useState } from "react";
import { Route as RouteIcon } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";
import { Button, Card, EmptyState, PageHeader, ProgressBar, Spinner, TextInput, cn } from "../components/ui";

const ALL_DIMENSIONS = [
  { key: "knowledge", label: "Knowledge" },
  { key: "skills", label: "Skills" },
  { key: "human_development", label: "Human Development" },
] as const;

type Dim = (typeof ALL_DIMENSIONS)[number]["key"];

export default function Paths() {
  const paths = trpc.paths.list.useQuery();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning paths"
        subtitle="Guided sequences that grow your three dimensions."
      />

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

      {paths.isLoading ? (
        <Spinner label="Loading…" />
      ) : paths.data && paths.data.length > 0 ? (
        <div className="space-y-3">
          {paths.data.map((p) => (
            <Link key={p.id} to={`/paths/${p.id}`}>
              <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-navy-900">{p.title}</span>
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
          title="No paths yet"
          description="Create your first learning path above to start tracking progress."
        />
      )}
    </div>
  );
}
