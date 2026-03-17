import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { aiAPI } from "@/api/apiClient";

export const SUPPORTED_LANGS = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "es", label: "Español", flag: "🇪🇸" },
  { code: "fr", label: "Français", flag: "🇫🇷" },
  { code: "de", label: "Deutsch", flag: "🇩🇪" },
  { code: "ar", label: "العربية", flag: "🇸🇦" },
  { code: "zh", label: "中文", flag: "🇨🇳" },
  { code: "pt", label: "Português", flag: "🇧🇷" },
  { code: "ja", label: "日本語", flag: "🇯🇵" },
];

const LanguageContext = createContext(null);

// In-memory translation cache with size limit
let translationCache = {};
const MAX_CACHE_SIZE = 1000;

function addToCache(key, value) {
  const keys = Object.keys(translationCache);
  if (keys.length >= MAX_CACHE_SIZE) {
    // Delete oldest entry
    delete translationCache[keys[0]];
  }
  translationCache[key] = value;
}

function detectBrowserLang() {
  const lang = navigator.language?.split("-")[0] || "en";
  return SUPPORTED_LANGS.find(l => l.code === lang) ? lang : "en";
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return localStorage.getItem("vetora_lang") || detectBrowserLang();
  });

  const setLang = (code) => {
    localStorage.setItem("vetora_lang", code);
    setLangState(code);
  };

  const translate = useCallback(async (texts) => {
    if (!texts || texts.length === 0) return texts;
    if (lang === "en") return texts;

    const cacheKey = `${lang}:${JSON.stringify(texts)}`;
    if (translationCache[cacheKey]) return translationCache[cacheKey];

    try {
      const res = await aiAPI.translate({
        texts,
        targetLang: lang,
      });

      const translated = res?.translations || texts;
      addToCache(cacheKey, translated);
      return translated;
    } catch (error) {
      console.error("Translation failed", error);
      return texts;
    }
  }, [lang]);

  const currentLangInfo = SUPPORTED_LANGS.find(l => l.code === lang) || SUPPORTED_LANGS[0];

  return (
    <LanguageContext.Provider value={{ lang, setLang, translate, SUPPORTED_LANGS, currentLangInfo }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) return { lang: "en", setLang: () => {}, translate: async (t) => t, SUPPORTED_LANGS, currentLangInfo: SUPPORTED_LANGS[0] };
  return ctx;
}

// Hook to translate a single text field reactively
export function useTranslated(text) {
  const { lang, translate } = useLang();
  const [out, setOut] = useState(text);

  useEffect(() => {
    setOut(text);
    if (!lang || lang === "en" || !text) return;
    translate([text]).then(res => setOut(res?.[0] ?? text));
  }, [text, lang, translate]);

  return out;
}