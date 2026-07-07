import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { DimensionGauges } from "../components/DimensionGauges";
import { SessionList } from "../components/SessionList";
import { Button, Card, EmptyState, ProgressBar, Spinner } from "../components/ui";

export default function Dashboard() {
  const me = trpc.auth.me.useQuery();
  const progression = trpc.paths.progression.useQuery();
  const paths = trpc.paths.list.useQuery();
  const sessions = trpc.sessions.mine.useQuery();
  const setupDemo = trpc.dev.setupMentorDemo.useMutation({
    onSuccess: () => window.location.assign("/mentor"),
  });

  const firstName = me.data?.name?.split(" ")[0] ?? "there";
  const active = (paths.data ?? []).filter((p) => p.itemCount > 0);
  const isPersonal = me.data?.activeOrganization?.type !== "team";
  // Upcoming sessions (keep ones starting within the last 30 min as "now").
  const upcoming = (sessions.data ?? []).filter(
    (s) => new Date(s.scheduledAt).getTime() > Date.now() - 30 * 60000,
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900">Hi {firstName} 👋</h1>
        <p className="mt-1 text-ink/55">Here's your development at a glance.</p>
      </div>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">Today</h2>
          <SessionList sessions={upcoming.slice(0, 2)} allowCancel={false} />
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gold">
          My progress
        </h2>
        {progression.data ? <DimensionGauges data={progression.data} /> : <Spinner label="Loading…" />}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-navy-900">Continue learning</h2>
          <Link
            to="/paths"
            className="inline-flex items-center gap-1 text-sm font-medium text-navy/70 transition hover:text-navy"
          >
            Manage paths <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {paths.isLoading ? (
          <Spinner label="Loading…" />
        ) : active.length > 0 ? (
          <div className="space-y-3">
            {active.map((p) => (
              <Link key={p.id} to={`/paths/${p.id}`}>
                <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-navy-900">{p.title}</span>
                    <span className="text-sm font-medium text-ink/50">{p.progress}%</span>
                  </div>
                  <ProgressBar value={p.progress} className="mt-3" />
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Plus}
            title="No learning paths yet"
            description="Create a guided path and start growing your three dimensions."
            action={
              <Link to="/paths">
                <Button icon={Plus}>Create your first path</Button>
              </Link>
            }
          />
        )}
      </section>

      {isPersonal && (
        <Card className="flex flex-wrap items-center justify-between gap-4 border-navy/15 bg-navy/[0.03] p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-navy-900">Mentor mode (demo)</h3>
              <p className="mt-0.5 max-w-md text-sm text-ink/55">
                Become a mentor in the Innovation Academy workspace with two assigned learners, to
                preview the mentor experience.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            onClick={() => setupDemo.mutate()}
            disabled={setupDemo.isPending}
          >
            {setupDemo.isPending ? "Setting up…" : "Enable mentor demo"}
          </Button>
        </Card>
      )}
    </div>
  );
}
