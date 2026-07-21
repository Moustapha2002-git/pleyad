import { Check, Rocket } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { Card, ProgressBar, cn } from "./ui";

/**
 * Onboarding checklist for team learners — turns an empty first visit into a
 * guided start. Every item is DERIVED from real state (nothing stored), and the
 * card disappears on its own once everything is done.
 */
export function GettingStarted() {
  const { t } = useT();
  const me = trpc.auth.me.useQuery();
  const mentors = trpc.mentor.myMentors.useQuery();
  const assigned = trpc.paths.assigned.useQuery();
  const playlists = trpc.playlists.mine.useQuery();
  const quizzes = trpc.quizzes.mine.useQuery();

  const isTeamLearner =
    me.data?.activeOrganization?.type === "team" && me.data?.activeOrganization?.role === "member";

  // Wait until everything resolved to avoid a flash of unchecked items.
  const ready =
    me.data !== undefined &&
    mentors.data !== undefined &&
    assigned.data !== undefined &&
    playlists.data !== undefined &&
    quizzes.data !== undefined;
  if (!isTeamLearner || !ready) return null;

  const hasQuizzes = (quizzes.data ?? []).length > 0;
  const steps: { key: string; label: string; hint: string; to: string; done: boolean }[] = [
    {
      key: "mentor",
      label: t("gettingStarted.meetMentor"),
      hint: t("gettingStarted.meetMentorHint"),
      to: "/mentoring",
      done: (mentors.data ?? []).length > 0,
    },
    {
      key: "path",
      label: t("gettingStarted.startPath"),
      hint: t("gettingStarted.startPathHint"),
      to: "/paths",
      done: (assigned.data ?? []).some((p) => p.progress > 0),
    },
    {
      key: "playlist",
      label: t("gettingStarted.buildPlaylist"),
      hint: t("gettingStarted.buildPlaylistHint"),
      to: "/paths",
      done: (playlists.data ?? []).length > 0,
    },
    ...(hasQuizzes
      ? [
          {
            key: "quiz",
            label: t("gettingStarted.takeQuiz"),
            hint: t("gettingStarted.takeQuizHint"),
            to: "/mentoring",
            done: (quizzes.data ?? []).some((q) => q.taken),
          },
        ]
      : []),
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null; // all set — get out of the way

  return (
    <Card className="border-navy/15 bg-navy/[0.03] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy/10 text-navy">
          <Rocket className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-navy-900">{t("gettingStarted.title")}</h3>
          <p className="text-xs text-ink/55">
            {t("gettingStarted.progress", { done: doneCount, total: steps.length })}
          </p>
        </div>
        <div className="w-24">
          <ProgressBar value={(doneCount / steps.length) * 100} />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {steps.map((s) => (
          <Link key={s.key} to={s.to}>
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                s.done ? "opacity-60" : "bg-white shadow-[var(--shadow-card)] hover:-translate-y-0.5",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                  s.done
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-gray-300 text-transparent",
                )}
              >
                <Check className="h-4 w-4" />
              </span>
              <span
                className={cn(
                  "font-medium",
                  s.done ? "text-ink/45 line-through" : "text-navy-900",
                )}
              >
                {s.label}
              </span>
              <span className="ml-auto hidden text-xs text-ink/45 sm:inline">{s.hint}</span>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
