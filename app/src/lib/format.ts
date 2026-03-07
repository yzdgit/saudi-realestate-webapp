import type { Locale } from "@/lib/i18n";

const localeMap: Record<Locale, string> = {
  en: "en-US",
  ar: "ar-SA"
};

function numberFormatter(
  locale: Locale,
  options: Intl.NumberFormatOptions
): Intl.NumberFormat {
  return new Intl.NumberFormat(localeMap[locale], {
    numberingSystem: "latn",
    ...options
  });
}

export function formatCurrency(value: number, locale: Locale): string {
  return numberFormatter(locale, {
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

export function formatArea(value: number, locale: Locale): string {
  return `${numberFormatter(locale, {
    maximumFractionDigits: 0
  }).format(value)} m²`;
}

export function formatNumber(value: number, locale: Locale): string {
  return numberFormatter(locale, {
    maximumFractionDigits: 0
  }).format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return numberFormatter(locale, {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

export function formatDecimal(value: number, locale: Locale, fractionDigits = 2): string {
  return numberFormatter(locale, {
    maximumFractionDigits: fractionDigits
  }).format(value);
}
