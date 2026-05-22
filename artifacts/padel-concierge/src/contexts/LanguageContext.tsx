import React, { createContext, useContext, useEffect, useState } from "react";
import i18n from "../i18n";

export type Language = "en" | "ru";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem("language");
    if (saved === "ru") return "ru";
    if (saved === "en") return "en";
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return browser === "ru" ? "ru" : "en";
  });

  const setLanguage = (lang: Language) => {
    i18n.changeLanguage(lang);
    localStorage.setItem("language", lang);
    setLanguageState(lang);
    document.documentElement.lang = lang;
  };

  useEffect(() => {
    i18n.changeLanguage(language);
    document.documentElement.lang = language;
  }, []);

  const t = (key: string, options?: Record<string, unknown>): string =>
    i18n.t(key, options) as string;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
