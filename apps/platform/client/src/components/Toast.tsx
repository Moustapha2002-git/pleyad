import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useT } from "../lib/i18n";
import { cn } from "./ui";

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; message: string };

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void } | null>(
  null,
);

/** Fire toasts from anywhere: `const toast = useToast(); toast.success("Saved")`. */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return {
    success: (m: string) => ctx.push("success", m),
    error: (m: string) => ctx.push("error", m),
    info: (m: string) => ctx.push("info", m),
  };
}

const STYLE: Record<ToastKind, { icon: typeof Info; box: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    box: "border-emerald-200 bg-emerald-50 text-emerald-900",
    iconColor: "text-emerald-500",
  },
  error: {
    icon: XCircle,
    box: "border-red-200 bg-red-50 text-red-900",
    iconColor: "text-red-500",
  },
  info: {
    icon: Info,
    box: "border-gray-200 bg-white text-navy-900",
    iconColor: "text-navy",
  },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t: translate } = useT();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);
  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, message }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => {
          const s = STYLE[t.kind];
          const Icon = s.icon;
          return (
            <div
              key={t.id}
              className={cn(
                "animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 shadow-[var(--shadow-pop)]",
                s.box,
              )}
              role="status"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", s.iconColor)} />
              <span className="flex-1 text-sm font-medium">{t.message}</span>
              <button
                onClick={() => remove(t.id)}
                className="shrink-0 opacity-50 transition hover:opacity-100"
                aria-label={translate("common.dismiss")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
