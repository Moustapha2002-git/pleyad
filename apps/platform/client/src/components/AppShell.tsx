import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Route as RouteIcon,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { trpc } from "../lib/trpc";
import { Avatar, cn } from "./ui";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

type NavItem = { to: string; label: string; icon: LucideIcon };

function useNavItems(): NavItem[] {
  const me = trpc.auth.me.useQuery();
  const role = me.data?.activeOrganization?.role;
  const inOrg = me.data?.activeOrganization?.type === "team";
  const isMentor = role === "mentor" || role === "admin" || role === "owner";
  const isLearnerInOrg = inOrg && role === "member";

  const items: NavItem[] = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/paths", label: "Learning paths", icon: RouteIcon },
  ];
  if (isMentor && inOrg) items.push({ to: "/mentor", label: "My learners", icon: Users });
  if (isLearnerInOrg) items.push({ to: "/mentoring", label: "Mentoring", icon: GraduationCap });
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
      {item.label.split(" ")[0]}
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });
  const items = useNavItems();
  const name = me.data?.name ?? me.data?.email ?? "";

  return (
    <div className="min-h-full">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-navy-950 px-4 py-6 md:flex">
        <div className="px-2">
          <span className="text-lg font-extrabold tracking-[0.28em] text-white">PLEYAD</span>
          <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-white/35">
            Operating system for learning
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
              <LogOut className="h-3 w-3" /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-gray-200/70 bg-white/80 px-5 py-3 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className="text-base font-extrabold tracking-[0.22em] text-navy-900 md:hidden">
              PLEYAD
            </span>
            <WorkspaceSwitcher />
          </div>
          <span className="hidden text-sm text-ink/60 sm:inline">{name}</span>
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
