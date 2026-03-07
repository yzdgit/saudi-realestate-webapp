import en from "@/i18n/en/common.json";
import ar from "@/i18n/ar/common.json";
import type { Locale } from "@/lib/i18n";

export type LocaleMessages = typeof en;

const dictionaries: Record<Locale, LocaleMessages> = {
  en,
  ar
};

export function getMessages(locale: Locale): LocaleMessages {
  return dictionaries[locale] ?? dictionaries.en;
}
