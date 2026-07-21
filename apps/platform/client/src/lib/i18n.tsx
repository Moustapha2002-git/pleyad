import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { dictionaries } from "./locales";

export type Lang = "en" | "fr";
export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

const STORAGE_KEY = "pleyad_lang";

/** BCP-47 tag per language — drives Intl date/time formatting. */
const LOCALE: Record<Lang, string> = { en: "en-US", fr: "fr-FR" };

function getInitial(): Lang {
  const v = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return v === "fr" || v === "en" ? v : "en";
}

/**
 * Current Intl locale, kept in sync by <I18nProvider> on every render.
 * Module-level so plain formatter helpers can read it without a hook —
 * pass it to toLocaleDateString/toLocaleTimeString instead of `undefined`,
 * which would follow the browser's locale rather than the chosen language.
 */
let currentLocale: string = LOCALE[getInitial()];
export const dateLocale = () => currentLocale;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lookup(obj: any, path: string): string | undefined {
  const v = path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return typeof v === "string" ? v : undefined;
}

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitial);

  // Sync during render so children formatting dates in this same pass
  // already see the new locale.
  currentLocale = LOCALE[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* private mode — ignore */
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      let s = lookup(dictionaries[lang], key) ?? lookup(dictionaries.en, key) ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return s;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within <I18nProvider>");
  return ctx;
}
