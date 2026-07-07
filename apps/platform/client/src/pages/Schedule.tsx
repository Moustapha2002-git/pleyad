import { CalendarClock } from "lucide-react";
import { trpc } from "../lib/trpc";
import { SessionList } from "../components/SessionList";
import { EmptyState, PageHeader, Spinner } from "../components/ui";

export default function Schedule() {
  const sessions = trpc.sessions.mine.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader title="My schedule" subtitle="Your upcoming mentoring sessions." />
      {sessions.isLoading ? (
        <Spinner label="Loading…" />
      ) : sessions.data && sessions.data.length > 0 ? (
        <SessionList sessions={sessions.data} />
      ) : (
        <EmptyState
          icon={CalendarClock}
          title="No sessions scheduled"
          description="When a mentoring session is scheduled, it will appear here."
        />
      )}
    </div>
  );
}
