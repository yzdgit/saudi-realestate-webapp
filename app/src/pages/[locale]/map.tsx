import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { useRouter } from "next/router";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { FilterPanelDesktop, FilterPanelMobile } from "@/features/filters/filter-panel";
import { useUrlFilters } from "@/features/filters/use-url-filters";
import type { MapOverlayMode } from "@/features/map/listings-map";
import { MapSkeleton } from "@/features/map/map-skeleton";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import {
  EMPTY_ANALYTICS_SNAPSHOT,
  EMPTY_MAP_AREA_STATS_BUNDLE,
  fetchKpiDaily,
  fetchMapAreaStatsDailyBundle,
  stripNumericFilterValues
} from "@/lib/queries/realestate";
import { isAbortLikeError } from "@/lib/queries/cache";
import { HARDCODED_FILTER_OPTIONS } from "@/lib/realestate/hardcoded-filter-options";
import type { Listing, MapAreaStat, MapLevel } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

const ListingsMap = dynamic(
  () => import("@/features/map/listings-map").then((module) => module.ListingsMap),
  {
    ssr: false,
    loading: () => <MapSkeleton />
  }
);

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function MapPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const router = useRouter();
  const messages = getMessages(locale);
  const { filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);
  const statsRequestRef = useRef(0);

  const [stats, setStats] = useState(EMPTY_ANALYTICS_SNAPSHOT);
  const [areaStatsByLevel, setAreaStatsByLevel] =
    useState<Partial<Record<MapLevel, MapAreaStat[]>>>(EMPTY_MAP_AREA_STATS_BUNDLE);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);
  const effectiveOverlayMode: MapOverlayMode = "intensity";
  const mapListings = useMemo(() => [] as Listing[], []);
  const mapFilters = useMemo(() => stripNumericFilterValues(filters), [filters]);
  const mapStatsFilters = useMemo(
    () => ({
      ...mapFilters,
      region: [],
      city: [],
      district: [],
      in_view: false
    }),
    [mapFilters]
  );
  const error = statsError;
  const isLoading = isLoadingStats;

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const controller = new AbortController();
    const requestId = statsRequestRef.current + 1;
    statsRequestRef.current = requestId;
    setIsLoadingStats(true);
    setStatsError(null);

    void Promise.all([
      fetchKpiDaily(mapStatsFilters, { signal: controller.signal }),
      fetchMapAreaStatsDailyBundle(mapStatsFilters, { signal: controller.signal })
    ])
      .then(([nextStats, areaStats]) => {
        if (statsRequestRef.current !== requestId) {
          return;
        }

        setStats(nextStats);
        setAreaStatsByLevel(areaStats);
      })
      .catch((nextError) => {
        if (statsRequestRef.current !== requestId) {
          return;
        }

        if (controller.signal.aborted) {
          return;
        }

        if (isAbortLikeError(nextError)) {
          return;
        }

        setStatsError(nextError instanceof Error ? nextError.message : messages.errors.load_map_stats);
        setAreaStatsByLevel(EMPTY_MAP_AREA_STATS_BUNDLE);
      })
      .finally(() => {
        if (statsRequestRef.current === requestId) {
          setIsLoadingStats(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [mapStatsFilters, router.isReady, messages.errors.load_map_stats]);

  useEffect(() => {
    if (!router.isReady || !filters.in_view) {
      return;
    }

    setFilters({ in_view: false }, { resetPage: false });
  }, [filters.in_view, router.isReady, setFilters]);

  return (
    <>
      <Head>
        <title>{messages.map.title}</title>
        <meta name="description" content={messages.map.description} />
        <link rel="alternate" hrefLang="en" href="/en/map/" />
        <link rel="alternate" hrefLang="ar" href="/ar/map/" />
        <link rel="preload" href="/static-data/listings.json" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/static-data/regions.geojson" as="fetch" crossOrigin="anonymous" />
      </Head>

      <ErrorBoundary
        title={messages.errors.boundary_title}
        description={messages.errors.boundary_description}
        actionLabel={messages.errors.boundary_action}
      >
      <ExplorerShell
        locale={locale}
        messages={messages}
        activePage="map"
        title={messages.map.title}
        description={messages.map.description}
        filterPanelDesktop={
          <FilterPanelDesktop
            locale={locale}
            messages={messages}
            filters={filters}
            options={HARDCODED_FILTER_OPTIONS}
            onPatch={setFilters}
            onReset={resetFilters}
            disableNumericFilters
          />
        }
        filterPanelMobile={
          <FilterPanelMobile
            locale={locale}
            messages={messages}
            filters={filters}
            options={HARDCODED_FILTER_OPTIONS}
            onPatch={setFilters}
            onReset={resetFilters}
            disableNumericFilters
          />
        }
        statsRow={<StatsRow locale={locale} messages={messages} snapshot={stats} />}
        hrefQuery={hrefQuery}
      >
        <div className="relative">
          <ListingsMap
            locale={locale}
            messages={messages}
            filters={filters}
            listings={mapListings}
            overlayMode={effectiveOverlayMode}
            areaStatsByLevel={areaStatsByLevel}
            onPatchFilters={setFilters}
            onSelectListing={() => undefined}
          />
          {error ? (
            <div className="pointer-events-none absolute end-3 top-3 z-[1002] rounded-md border border-destructive/60 bg-background/90 px-2 py-1 text-[11px] text-destructive backdrop-blur">
              {error}
            </div>
          ) : isLoading ? (
            <div className="pointer-events-none absolute end-3 top-3 z-[1002] rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
              {messages.loading.map_updating}
            </div>
          ) : null}
        </div>
      </ExplorerShell>
      </ErrorBoundary>
    </>
  );
}
