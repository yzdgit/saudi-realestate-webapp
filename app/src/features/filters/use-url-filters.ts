import { useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import type { Locale } from "@/lib/i18n";
import {
  defaultFilters,
  normalizeFilters,
  parseFiltersFromQuery,
  serializeFiltersToQuery,
  withResetPage
} from "@/lib/realestate/pipeline";
import type { ListingFilters } from "@/lib/realestate/types";

type SetterOptions = {
  resetPage?: boolean;
};

export function useUrlFilters(locale: Locale) {
  const router = useRouter();

  const filters = useMemo(() => normalizeFilters(parseFiltersFromQuery(router.query)), [router.query]);

  const setFilters = useCallback(
    (
      updater: Partial<ListingFilters> | ((current: ListingFilters) => ListingFilters),
      options: SetterOptions = { resetPage: true }
    ) => {
      const next =
        typeof updater === "function"
          ? updater(filters)
          : {
              ...filters,
              ...updater
            };

      const normalizedNext = normalizeFilters(next);
      const finalFilters = options.resetPage ? withResetPage(normalizedNext) : normalizedNext;
      const query = {
        locale,
        ...serializeFiltersToQuery(finalFilters)
      };

      void router.replace(
        {
          pathname: router.pathname,
          query
        },
        undefined,
        { shallow: true, scroll: false }
      );
    },
    [filters, locale, router]
  );

  const resetFilters = useCallback(() => {
    const query = {
      locale,
      ...serializeFiltersToQuery(defaultFilters)
    };

    void router.replace(
      {
        pathname: router.pathname,
        query
      },
      undefined,
      { shallow: true, scroll: false }
    );
  }, [locale, router]);

  const hrefQuery = useMemo(
    () => ({
      locale,
      ...serializeFiltersToQuery(filters)
    }),
    [filters, locale]
  );

  return {
    filters,
    setFilters,
    resetFilters,
    hrefQuery
  };
}
