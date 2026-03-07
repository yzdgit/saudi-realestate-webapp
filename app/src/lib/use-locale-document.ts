import { useEffect } from "react";
import { localeDir, type Locale } from "@/lib/i18n";

export function useLocaleDocument(locale: Locale) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = localeDir(locale);
    document.documentElement.classList.add("dark");
  }, [locale]);
}
