import { useState } from "react";
import { ArrowRight, GraduationCap, Shield, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { AuthShell } from "../components/AuthShell";
import { cn } from "../components/ui";

/**
 * Pre-login entry screen. Lets a visitor jump straight into a demo account for each
 * role, so the three experiences can be shown cleanly (e.g. during a pilot demo).
 * Real users sign in normally — role is always derived from the account server-side.
 */
const ROLES: {
  key: string;
  label: string;
  email: string;
  icon: LucideIcon;
  tint: string;
  blurb: string;
}[] = [
  {
    key: "learner",
    label: "Learner",
    email: "ahmed.learner@demo.pleyad.test",
    icon: GraduationCap,
    tint: "bg-dim-knowledge/10 text-dim-knowledge",
    blurb: "Your paths, playlists, mentor, tasks and 3-dimension progress.",
  },
  {
    key: "mentor",
    label: "Mentor",
    email: "sara@demo.pleyad.test",
    icon: Users,
    tint: "bg-gold/15 text-gold",
    blurb: "The mentor cockpit: learners, progress, tasks, quizzes, sessions.",
  },
  {
    key: "admin",
    label: "Admin",
    email: "admin@demo.pleyad.test",
    icon: Shield,
    tint: "bg-dim-human/10 text-dim-human",
    blurb: "The admin console: members, mentor assignment, cohort analytics.",
  },
];

const DEMO_PASSWORD = "demo1234";

export default function Welcome() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [pending, setPending] = useState<string | null>(null);

  const login = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await utils.auth.me.invalidate();
      navigate("/");
    },
    onError: () => setPending(null),
  });

  const enterAs = (role: (typeof ROLES)[number]) => {
    setPending(role.key);
    login.mutate({ email: role.email, password: DEMO_PASSWORD });
  };

  return (
    <AuthShell
      title="Explore Pleyad"
      subtitle="Jump into a demo experience, or sign in with your account."
      footer={
        <>
          Have an account?{" "}
          <Link to="/login" className="font-semibold text-navy underline">
            Sign in
          </Link>
        </>
      }
    >
      <div className="space-y-3">
        {ROLES.map((r) => {
          const Icon = r.icon;
          const isPending = pending === r.key;
          return (
            <button
              key={r.key}
              onClick={() => enterAs(r)}
              disabled={pending !== null}
              className={cn(
                "flex w-full items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4 text-left transition",
                "hover:-translate-y-0.5 hover:border-navy/30 hover:shadow-[var(--shadow-pop)]",
                pending !== null && !isPending && "opacity-50",
              )}
            >
              <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", r.tint)}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-navy-900">
                  Enter as {r.label}
                  <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink/50">
                    Demo
                  </span>
                </span>
                <span className="mt-0.5 block text-xs text-ink/55">{r.blurb}</span>
              </span>
              <ArrowRight
                className={cn("h-5 w-5 shrink-0 text-ink/30", isPending && "animate-pulse")}
              />
            </button>
          );
        })}
      </div>
    </AuthShell>
  );
}
