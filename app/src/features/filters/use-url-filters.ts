import { useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { parseExplorerMode, type ExplorerMode } from "@/lib/explorer-mode";
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
  const mode = useMemo(() => parseExplorerMode(router.query.mode), [router.query.mode]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const rawMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode;

    if (typeof rawMode === "string" && rawMode === mode) {
      return;
    }

    const query = {
      locale,
      mode,
      ...serializeFiltersToQuery(filters)
    };

    void router.replace(
      {
        pathname: router.pathname,
        query
      },
      undefined,
      { shallow: true, scroll: false }
    );
  }, [filters, locale, mode, router]);

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
        mode,
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
    [filters, locale, mode, router]
  );

  const resetFilters = useCallback(() => {
    const query = {
      locale,
      mode,
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
  }, [locale, mode, router]);

  const setMode = useCallback(
    (nextMode: ExplorerMode) => {
      const query = {
        locale,
        mode: nextMode,
        ...serializeFiltersToQuery(filters)
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

  const hrefQuery = useMemo(
    () => ({
      locale,
      mode,
      ...serializeFiltersToQuery(filters)
    }),
    [filters, locale, mode]
  );

  return {
    mode,
    filters,
    setFilters,
    setMode,
    resetFilters,
    hrefQuery
  };
}
