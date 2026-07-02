import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";

export default function Dashboard() {
  const me = trpc.auth.me.useQuery();
  const progression = trpc.paths.progression.useQuery();
  const paths = trpc.paths.list.useQuery();

  const firstName = me.data?.name?.split(" ")[0] ?? "there";
  const active = (paths.data ?? []).filter((p) => p.itemCount > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Hi {firstName} 👋</h1>
        <p className="text-ink/60">Here's your development at a glance.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold">
          My progress
        </h2>
        {progression.data ? (
          <DimensionGauges data={progression.data} />
        ) : (
          <p className="text-ink/50">Loading…</p>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy">Continue learning</h2>
          <Link to="/paths" className="text-sm text-navy/70 hover:underline">
            Manage paths →
          </Link>
        </div>
        {paths.isLoading ? (
          <p className="text-ink/50">Loading…</p>
        ) : active.length > 0 ? (
          <div className="space-y-3">
            {active.map((p) => (
              <Link
                key={p.id}
                to={`/paths/${p.id}`}
                className="block rounded-xl border border-gray-200 bg-white p-5 transition hover:border-navy/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-navy">{p.title}</span>
                  <span className="text-sm text-ink/50">{p.progress}%</span>
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-gold" style={{ width: `${p.progress}%` }} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-ink/60">No learning paths yet.</p>
            <Link
              to="/paths"
              className="mt-3 inline-block rounded-lg bg-navy px-4 py-2 text-sm text-white transition hover:bg-navy-600"
            >
              Create your first path
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
