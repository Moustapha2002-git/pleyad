import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart3,
  CalendarDays,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Route as RouteIcon,
  Settings as SettingsIcon,
  Shield,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "../lib/trpc";
import { applyBrandColor } from "../lib/branding";
import { useT } from "../lib/i18n";
import { Avatar, cn } from "./ui";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { IncomingCallBanner } from "./IncomingCallBanner";
import { NotificationBell } from "./NotificationBell";

type NavItem = { to: string; label: string; short: string; icon: LucideIcon };

/**
 * Strict role separation: each role only sees its own world.
 * Admin = manage + measure. Mentor = coach + author. Learner = learn.
 * (Personal workspaces keep the learner-style experience.)
 */
function useNavItems(): NavItem[] {
  const me = trpc.auth.me.useQuery();
  const { t } = useT();
  const role = me.data?.activeOrganization?.role;
  const inOrg = me.data?.activeOrganization?.type === "team";

  if (inOrg && (role === "admin" || role === "owner")) {
    return [
      { to: "/learners", label: t("nav.learners"), short: t("nav.learners"), icon: Users },
      { to: "/mentors", label: t("nav.mentors"), short: t("nav.mentors"), icon: GraduationCap },
      { to: "/paths", label: t("nav.paths"), short: t("nav.paths"), icon: RouteIcon },
      { to: "/admin", label: t("nav.admin"), short: t("nav.admin"), icon: Shield },
      { to: "/analytics", label: t("nav.analytics"), short: t("nav.stats"), icon: BarChart3 },
    ];
  }
  if (inOrg && (role === "mentor" || role === "manager")) {
    return [
      { to: "/mentor", label: t("nav.learners"), short: t("nav.learners"), icon: Users },
      { to: "/paths", label: t("nav.paths"), short: t("nav.paths"), icon: RouteIcon },
      { to: "/schedule", label: t("nav.schedule"), short: t("nav.agenda"), icon: CalendarDays },
    ];
  }
  const items: NavItem[] = [
    { to: "/", label: t("nav.dashboard"), short: t("nav.home"), icon: LayoutDashboard },
    { to: "/paths", label: t("nav.myLearning"), short: t("nav.learn"), icon: RouteIcon },
  ];
  if (inOrg) {
    items.push({ to: "/schedule", label: t("nav.schedule"), short: t("nav.agenda"), icon: CalendarDays });
    items.push({ to: "/mentoring", label: t("nav.mentoring"), short: t("nav.mentor"), icon: GraduationCap });
  }
  return items;
}

function SideLink({ item }: { item: NavItem }) {
  const [loc] = useLocation();
  const active = item.to === "/" ? loc === "/" : loc.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon className="h-5 w-5" />
      {item.label}
    </Link>
  );
}

function TabLink({ item }: { item: NavItem }) {
  const [loc] = useLocation();
  const active = item.to === "/" ? loc === "/" : loc.startsWith(item.to);
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex flex-1 flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium transition",
        active ? "text-white" : "text-white/45",
      )}
    >
      <Icon className="h-5 w-5" />
      {item.short}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const { t } = useT();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const items = useNavItems();
  const name = me.data?.name ?? me.data?.email ?? "";
  const roleLabel = me.data?.activeOrganization
    ? t(`roles.${me.data.activeOrganization.role}`)
    : null;
  const branding = me.data?.activeOrganization?.branding ?? null;
  const orgName = me.data?.activeOrganization?.name ?? "";

  // Re-theme to the workspace's brand color (and back) whenever it changes.
  useEffect(() => {
    applyBrandColor(branding?.primaryColor);
    return () => applyBrandColor(null);
  }, [branding?.primaryColor]);

  return (
    <div className="min-h-full">
      {/* Global incoming-call ringer — shows on any page */}
      <IncomingCallBanner />

      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy-950 px-4 py-6 md:flex">
        <div className="px-2">
          {branding?.logoUrl ? (
            <div className="flex items-center gap-2.5">
              <img
                src={branding.logoUrl}
                alt={orgName}
                className="h-9 w-9 shrink-0 rounded-lg bg-white/10 object-contain p-1"
              />
              <span className="truncate text-base font-bold text-white">{orgName}</span>
            </div>
          ) : (
            <span className="text-lg font-extrabold tracking-[0.28em] text-white">PLEYAD</span>
          )}
          <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/35">
            {branding?.logoUrl ? t("common.poweredBy") : t("common.appTagline")}
          </p>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((it) => (
            <SideLink key={it.to} item={it} />
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <Avatar name={name || "?"} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-white">{name}</div>
            <button
              onClick={() => logout.mutate()}
              className="mt-0.5 flex items-center gap-1 text-xs text-white/45 transition hover:text-white"
            >
              <LogOut className="h-3 w-3" /> {t("nav.signOut")}
            </button>
          </div>
          <Link
            to="/settings"
            className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white"
            aria-label={t("nav.settings")}
          >
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200/70 bg-white/80 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt={orgName}
                className="h-8 w-8 shrink-0 rounded-lg object-contain md:hidden"
              />
            ) : (
              <span className="text-base font-extrabold tracking-[0.22em] text-navy-900 md:hidden">
                PLEYAD
              </span>
            )}
            <WorkspaceSwitcher />
            {roleLabel && (
              <span className="hidden rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-semibold text-navy/70 sm:inline">
                {roleLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <NotificationBell />
            {/* Settings + Sign out — the sidebar is hidden on mobile, so surface them here */}
            <Link
              to="/settings"
              className="rounded-lg p-2 text-ink/60 transition hover:bg-gray-100 hover:text-navy md:hidden"
              aria-label={t("nav.settings")}
            >
              <SettingsIcon className="h-5 w-5" />
            </Link>
            <button
              onClick={() => logout.mutate()}
              className="rounded-lg p-2 text-ink/60 transition hover:bg-gray-100 hover:text-navy md:hidden"
              aria-label={t("nav.signOut")}
            >
              <LogOut className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-ink/60 sm:inline">{name}</span>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-8 pb-24 md:pb-10">{children}</main>
      </div>

      {/* Bottom tab bar — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch gap-1 border-t border-white/10 bg-navy-950 px-3 py-2 md:hidden">
        {items.map((it) => (
          <TabLink key={it.to} item={it} />
        ))}
      </nav>
    </div>
  );
}
