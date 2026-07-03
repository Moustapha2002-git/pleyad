import { ChevronRight, Users } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { Avatar, Card, EmptyState, PageHeader, Spinner } from "../components/ui";

export default function MentorLearners() {
  const learners = trpc.mentor.myLearners.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader title="My learners" subtitle="Learners assigned to you in this workspace." />

      {learners.isLoading ? (
        <Spinner label="Loading…" />
      ) : learners.data && learners.data.length > 0 ? (
        <div className="space-y-3">
          {learners.data.map((l) => (
            <Link key={l.id} to={`/mentor/${l.id}`}>
              <Card className="flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                <Avatar name={l.name ?? l.email ?? "?"} className="h-11 w-11" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-navy-900">{l.name ?? l.email}</div>
                  <div className="truncate text-sm text-ink/50">{l.email}</div>
                </div>
                <ChevronRight className="h-5 w-5 text-ink/30" />
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No learners assigned yet"
          description="Learners assigned to you will appear here."
        />
      )}
    </div>
  );
}
