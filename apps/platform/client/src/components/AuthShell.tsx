import type { ReactNode } from "react";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-full md:grid-cols-2">
      {/* Brand panel */}
      <div className="hidden flex-col justify-between bg-navy p-12 text-white md:flex">
        <div className="text-2xl font-bold tracking-[0.3em]">PLEYAD</div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            The operating system
            <br />
            for learning.
          </h1>
          <p className="mt-4 max-w-sm text-white/70">
            Connect everything you learn — across every platform — into one guided,
            measurable journey.
          </p>
        </div>
        <div className="text-sm text-white/50">Powered by Pleyad</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-navy">{title}</h2>
          {subtitle && <p className="mt-1 text-ink/60">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink/60">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
