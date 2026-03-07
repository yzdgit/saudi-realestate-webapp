import type { Locale } from "@/lib/i18n";

export function localeAlternateLinks(pathname: string): Record<Locale, string> {
  return {
    en: `/en${pathname}`,
    ar: `/ar${pathname}`
  };
}
