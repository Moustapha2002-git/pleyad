import { useState } from "react";
import {
  Bell,
  CalendarClock,
  ClipboardCheck,
  ListChecks,
  MessageSquare,
  MessageSquareQuote,
  Route as RouteIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { useT } from "../lib/i18n";
import { cn } from "./ui";

const META = {
  path_assigned: { icon: RouteIcon, tint: "bg-dim-knowledge/10 text-dim-knowledge" },
  task: { icon: ClipboardCheck, tint: "bg-navy/10 text-navy" },
  feedback: { icon: MessageSquareQuote, tint: "bg-dim-human/10 text-dim-human" },
  session: { icon: CalendarClock, tint: "bg-gold/15 text-gold" },
  quiz: { icon: ListChecks, tint: "bg-dim-skills/10 text-dim-skills" },
  message: { icon: MessageSquare, tint: "bg-navy/10 text-navy" },
} satisfies Record<string, { icon: LucideIcon; tint: string }>;

type T = (key: string, vars?: Record<string, string | number>) => string;

const relativeTime = (d: string | Date, t: T) => {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return t("notifications.justNow");
  const m = Math.floor(s / 60);
  if (m < 60) return t("notifications.minutesAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("notifications.hoursAgo", { n: h });
  const days = Math.floor(h / 24);
  return days === 1 ? t("notifications.yesterday") : t("notifications.daysAgo", { n: days });
};

export function NotificationBell() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const unread = trpc.notifications.unreadCount.useQuery(undefined, {
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });
  const list = trpc.notifications.list.useQuery(undefined, { enabled: open });
  const markAll = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => {
      utils.notifications.unreadCount.invalidate();
      utils.notifications.list.invalidate();
    },
  });

  const count = unread.data ?? 0;

  const toggle = () => {
    const willOpen = !open;
    setOpen(willOpen);
    if (willOpen && count > 0) markAll.mutate();
  };

  const items = list.data ?? [];

  return (
    <div className="relative">
      <button
        onClick={toggle}
        className="relative rounded-lg p-2 text-ink/60 transition hover:bg-gray-100 hover:text-navy"
        aria-label={t("notifications.title")}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[var(--shadow-pop)]">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-navy-900">{t("notifications.title")}</span>
              {items.length > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs font-medium text-navy/60 transition hover:text-navy"
                >
                  {t("notifications.markAllRead")}
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {list.isLoading ? (
                <p className="px-4 py-6 text-center text-sm text-ink/45">{t("common.loading")}</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-ink/45">
                  {t("notifications.allCaughtUp")}
                </p>
              ) : (
                items.map((n) => {
                  const m = META[n.type] ?? META.message;
                  const Icon = m.icon;
                  const clickable = Boolean(n.linkTo);
                  return (
                    <button
                      key={n.id}
                      disabled={!clickable}
                      onClick={() => {
                        if (n.linkTo) setLocation(n.linkTo);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-start gap-3 px-4 py-3 text-left transition",
                        clickable ? "hover:bg-gray-50" : "cursor-default",
                        !n.readAt && "bg-navy/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          m.tint,
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-navy-900">{n.title}</span>
                        {n.body && (
                          <span className="mt-0.5 block truncate text-xs text-ink/55">{n.body}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-ink/40">
                          {relativeTime(n.createdAt, t)}
                        </span>
                      </span>
                      {!n.readAt && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-navy-900" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
