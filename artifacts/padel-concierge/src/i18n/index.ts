import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ru from "./ru.json";

const saved = typeof localStorage !== "undefined" ? localStorage.getItem("language") : null;
const initialLang = saved === "ru" ? "ru" : "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initialLang,
  fallbackLng: "en",
  supportedLngs: ["en", "ru"],
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
