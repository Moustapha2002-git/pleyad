import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";

const ALL_DIMENSIONS = [
  { key: "knowledge", label: "Knowledge (Savoir)" },
  { key: "skills", label: "Skills (Savoir-faire)" },
  { key: "human_development", label: "Human Development (Savoir-être)" },
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
      <div>
        <h1 className="text-2xl font-bold text-navy">Learning paths</h1>
        <p className="text-ink/60">Guided sequences that grow your three dimensions.</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">Create a path</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate({ title: title.trim(), dimensions: dims });
          }}
          className="space-y-4"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Path title (e.g. Junior Developer Training)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-navy"
          />
          <div className="flex flex-wrap gap-2">
            {ALL_DIMENSIONS.map((d) => (
              <button
                type="button"
                key={d.key}
                onClick={() => toggle(d.key)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  dims.includes(d.key)
                    ? "border-navy bg-navy text-white"
                    : "border-gray-300 text-ink/70 hover:border-navy/40"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <button
            disabled={create.isPending}
            className="rounded-lg bg-navy px-4 py-2 text-white transition hover:bg-navy-600 disabled:opacity-50"
          >
            Create path
          </button>
        </form>
      </section>

      <section className="space-y-3">
        {paths.isLoading ? (
          <p className="text-ink/50">Loading…</p>
        ) : paths.data && paths.data.length > 0 ? (
          paths.data.map((p) => (
            <Link
              key={p.id}
              to={`/paths/${p.id}`}
              className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-navy/40 hover:shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-navy">{p.title}</span>
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
              <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                <div className="h-2 rounded-full bg-gold" style={{ width: `${p.progress}%` }} />
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-ink/50">
            No paths yet — create your first above.
          </p>
        )}
      </section>
    </div>
  );
}
