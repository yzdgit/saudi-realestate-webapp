import type { GetStaticPaths, GetStaticPropsContext, GetStaticPropsResult } from "next";
import { isSupportedLocale, locales, type Locale } from "@/lib/i18n";

export type LocalePageProps = {
  locale: Locale;
};

export const localeStaticPaths: GetStaticPaths = async () => ({
  paths: locales.map((locale) => ({ params: { locale } })),
  fallback: false
});

export function resolveLocaleFromParams(params: GetStaticPropsContext["params"]): Locale {
  const raw = String(params?.locale ?? "");

  return isSupportedLocale(raw) ? raw : "en";
}

export function localeStaticProps(
  context: GetStaticPropsContext
): GetStaticPropsResult<LocalePageProps> {
  return {
    props: {
      locale: resolveLocaleFromParams(context.params)
    }
  };
}
