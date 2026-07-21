import { CalendarClock } from "lucide-react";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { SessionList } from "../components/SessionList";
import { EmptyState, PageHeader, Spinner } from "../components/ui";

export default function Schedule() {
  const { t } = useT();
  const sessions = trpc.sessions.mine.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader title={t("schedule.title")} subtitle={t("schedule.subtitle")} />
      {sessions.isLoading ? (
        <Spinner label={t("common.loading")} />
      ) : sessions.data && sessions.data.length > 0 ? (
        <SessionList sessions={sessions.data} />
      ) : (
        <EmptyState
          icon={CalendarClock}
          title={t("schedule.emptyTitle")}
          description={t("schedule.emptyDesc")}
        />
      )}
    </div>
  );
}
