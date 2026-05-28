import { useCallback } from "react";

import { useAuth } from "@/context/AuthContext";

import ar from "./ar.json";
import en from "./en.json";
import ru from "./ru.json";

export type Language = "en" | "ru" | "ar";

type Bundle = Record<string, unknown>;

const bundles: Record<Language, Bundle> = {
  en: en as Bundle,
  ru: ru as Bundle,
  ar: ar as Bundle,
};

function normalizeLang(lang: string | undefined | null): Language {
  if (lang === "ru") return "ru";
  if (lang === "ar") return "ar";
  return "en";
}

function lookup(bundle: Bundle, key: string): string | undefined {
  const parts = key.split(".");
  let cursor: unknown = bundle;
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in (cursor as Bundle)) {
      cursor = (cursor as Bundle)[part];
    } else {
      return undefined;
    }
  }
  return typeof cursor === "string" ? cursor : undefined;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name: string) => {
    const v = vars[name];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function translate(
  lang: string | undefined | null,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const normalized = normalizeLang(lang);
  const value =
    lookup(bundles[normalized], key) ?? lookup(bundles.en, key) ?? key;
  return interpolate(value, vars);
}

export function translateWithFallback(
  lang: string | undefined | null,
  key: string,
  fallback: string,
  vars?: Record<string, string | number>,
): string {
  const normalized = normalizeLang(lang);
  const value = lookup(bundles[normalized], key) ?? lookup(bundles.en, key);
  return interpolate(value ?? fallback, vars);
}

export function useTranslation() {
  const { user } = useAuth();
  const language = normalizeLang(user?.language);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(language, key, vars),
    [language],
  );
  const tOrFallback = useCallback(
    (key: string, fallback: string, vars?: Record<string, string | number>) =>
      translateWithFallback(language, key, fallback, vars),
    [language],
  );
  return { t, tOrFallback, language };
}
