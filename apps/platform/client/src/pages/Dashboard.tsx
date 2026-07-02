import { useState } from "react";
import { trpc } from "../lib/trpc";

export default function Dashboard() {
  const me = trpc.auth.me.useQuery();
  const collections = trpc.collections.list.useQuery();
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");

  const create = trpc.collections.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      await utils.collections.list.invalidate();
    },
  });

  const firstName = me.data?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Hi {firstName} 👋</h1>
        <p className="text-ink/60">Here's your learning space.</p>
      </div>

      {/* "Today" — the V1 centerpiece, scaffolded */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-gold">Today</h2>
        <p className="text-ink/70">
          Your guided next step will appear here once you start a learning path.
          <span className="text-ink/40"> (Coming in V1.)</span>
        </p>
      </section>

      {/* Playlists — proves tenant-scoped data end-to-end in the browser */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-navy">My playlists</h2>
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate({ title: title.trim() });
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New playlist title"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 outline-none transition focus:border-navy"
          />
          <button
            className="rounded-lg bg-navy px-4 py-2 text-white transition hover:bg-navy-600 disabled:opacity-50"
            disabled={create.isPending}
          >
            Add
          </button>
        </form>

        {collections.isLoading ? (
          <p className="text-ink/50">Loading…</p>
        ) : collections.data && collections.data.length > 0 ? (
          <ul className="divide-y divide-gray-100">
            {collections.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-ink">{c.title}</span>
                <span className="rounded-full bg-navy/5 px-2 py-0.5 text-xs text-navy/60">
                  {c.kind}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-ink/50">No playlists yet — create your first above.</p>
        )}
      </section>
    </div>
  );
}
