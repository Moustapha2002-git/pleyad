import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionChip } from "../components/DimensionGauges";

const PLATFORMS = ["youtube", "coursera", "udemy", "edx", "linkedin", "other"] as const;
type Platform = (typeof PLATFORMS)[number];

export default function PathDetail({ id }: { id: number }) {
  const path = trpc.paths.get.useQuery({ id });
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");

  const refresh = async () => {
    await utils.paths.get.invalidate({ id });
    await utils.paths.list.invalidate();
    await utils.paths.progression.invalidate();
  };
  const addItem = trpc.paths.addItem.useMutation({
    onSuccess: async () => {
      setTitle("");
      setUrl("");
      await refresh();
    },
  });
  const setStatus = trpc.paths.setItemStatus.useMutation({ onSuccess: refresh });

  if (path.isLoading) return <p className="text-ink/50">Loading…</p>;
  if (!path.data) return <p className="text-ink/50">Path not found.</p>;
  const p = path.data;

  return (
    <div className="space-y-6">
      <Link to="/paths" className="text-sm text-navy/70 hover:underline">
        ← All paths
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-navy">{p.title}</h1>
        {p.dimensions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {p.dimensions.map((d) => (
              <DimensionChip key={d} dimension={d} />
            ))}
          </div>
        )}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-2.5 flex-1 rounded-full bg-gray-100">
            <div className="h-2.5 rounded-full bg-gold" style={{ width: `${p.progress}%` }} />
          </div>
          <span className="text-sm font-medium text-navy">{p.progress}%</span>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">Steps</h2>
        {p.items.length === 0 ? (
          <p className="text-ink/50">No steps yet — add the first below.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {p.items.map((it) => (
              <li key={it.itemId} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={it.done}
                  onChange={(e) =>
                    setStatus.mutate({ resourceId: it.resourceId, done: e.target.checked })
                  }
                  className="h-5 w-5 accent-[#0a2540]"
                />
                <div className="flex-1">
                  <span
                    className={`font-medium ${it.done ? "text-ink/40 line-through" : "text-ink"}`}
                  >
                    {it.title}
                  </span>
                  {it.platform && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-ink/50">
                      {it.platform}
                    </span>
                  )}
                </div>
                {it.url && (
                  <a
                    href={it.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-navy/70 hover:underline"
                  >
                    Open
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">Add a step</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim())
              addItem.mutate({ pathId: id, title: title.trim(), platform, url: url || undefined });
          }}
          className="space-y-3"
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Step title (e.g. Python Basics — Coursera)"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-navy"
          />
          <div className="flex gap-2">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value as Platform)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            >
              {PLATFORMS.map((pl) => (
                <option key={pl} value={pl}>
                  {pl}
                </option>
              ))}
            </select>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="URL (optional)"
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none focus:border-navy"
            />
          </div>
          <button
            disabled={addItem.isPending}
            className="rounded-lg bg-navy px-4 py-2 text-white transition hover:bg-navy-600 disabled:opacity-50"
          >
            Add step
          </button>
        </form>
      </section>
    </div>
  );
}
