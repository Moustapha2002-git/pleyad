import type { ReactNode } from "react";
import { useT } from "../lib/i18n";

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
  const { t } = useT();
  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-navy-700/40 blur-3xl" />
        <div className="absolute -bottom-28 -left-16 h-80 w-80 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative text-xl font-extrabold tracking-[0.3em]">PLEYAD</div>
        <div className="relative">
          <h1 className="whitespace-pre-line text-4xl font-bold leading-tight">
            {t("auth.brandHeadline")}
          </h1>
          <p className="mt-4 max-w-sm text-white/60">{t("auth.brandSub")}</p>
        </div>
        <div className="relative text-sm text-white/40">{t("common.poweredBy")}</div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-8">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h2>
          {subtitle && <p className="mt-1.5 text-ink/55">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-ink/55">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
