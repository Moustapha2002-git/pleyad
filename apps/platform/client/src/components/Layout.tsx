import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "../lib/trpc";

function NavLink({ to, label }: { to: string; label: string }) {
  const [location] = useLocation();
  const active = to === "/" ? location === "/" : location.startsWith(to);
  return (
    <Link
      to={to}
      className={`text-sm transition ${active ? "font-semibold text-navy" : "text-ink/60 hover:text-navy"}`}
    >
      {label}
    </Link>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const me = trpc.auth.me.useQuery();
  const utils = trpc.useUtils();
  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
  });

  return (
    <div className="min-h-full bg-gray-50">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
        <div className="flex items-center gap-6">
          <span className="text-lg font-bold tracking-[0.25em] text-navy">PLEYAD</span>
          <nav className="hidden gap-5 sm:flex">
            <NavLink to="/" label="Dashboard" />
            <NavLink to="/paths" label="Learning paths" />
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden rounded-full bg-navy/5 px-3 py-1 text-sm text-navy/70 sm:inline">
            Personal workspace
          </span>
          <span className="text-sm text-ink/70">{me.data?.name ?? me.data?.email}</span>
          <button
            onClick={() => logout.mutate()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
