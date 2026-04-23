import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "@/locales/en/translation.json";
import es from "@/locales/es/translation.json";
import fr from "@/locales/fr/translation.json";
import de from "@/locales/de/translation.json";
import ar from "@/locales/ar/translation.json";
import zh from "@/locales/zh/translation.json";
import pt from "@/locales/pt/translation.json";
import ja from "@/locales/ja/translation.json";
import rw from "@/locales/rw/translation.json";
import sw from "@/locales/sw/translation.json";

export const SUPPORTED_LANG_CODES = ["en", "es", "fr", "de", "ar", "zh", "pt", "ja", "rw", "sw"];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      de: { translation: de },
      ar: { translation: ar },
      zh: { translation: zh },
      pt: { translation: pt },
      ja: { translation: ja },
      rw: { translation: rw },
      sw: { translation: sw },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANG_CODES,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "iqon_lang",
      caches: ["localStorage"],
    },
  });

export default i18n;
