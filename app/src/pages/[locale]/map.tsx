import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { useRouter } from "next/router";
import { AdPlaceholder } from "@/components/ads/ad-placeholder";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { FilterPanelDesktop, FilterPanelMobile } from "@/features/filters/filter-panel";
import { useUrlFilters } from "@/features/filters/use-url-filters";
import { ListingDetailsDrawer } from "@/features/listings/listing-details-drawer";
import { MapLegend } from "@/features/map/map-legend";
import type { MapOverlayMode } from "@/features/map/listings-map";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import {
  EMPTY_ANALYTICS_SNAPSHOT,
  EMPTY_FILTER_OPTIONS,
  EMPTY_MAP_POINTS_RESULT,
  fetchFilterOptions,
  fetchListingsStats,
  fetchMapAreaStats,
  fetchMapPoints
} from "@/lib/queries/realestate";
import type { Listing, MapAreaStat, MapBounds, MapLevel } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

const ListingsMap = dynamic(
  () => import("@/features/map/listings-map").then((module) => module.ListingsMap),
  {
    ssr: false,
    loading: () => <div className="h-[58vh] min-h-[420px] animate-pulse rounded-xl bg-muted" />
  }
);

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function MapPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const router = useRouter();
  const messages = getMessages(locale);
  const { mode, setMode, filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);
  const mapInViewDefaultAppliedRef = useRef(false);
  const dataRequestRef = useRef(0);
  const areaRequestRef = useRef(0);

  const [bounds, setBounds] = useState<MapBounds | undefined>();
  const [debouncedBounds, setDebouncedBounds] = useState<MapBounds | undefined>();
  const [overlayMode, setOverlayMode] = useState<MapOverlayMode>("markers");
  const [filterOptions, setFilterOptions] = useState(EMPTY_FILTER_OPTIONS);
  const [stats, setStats] = useState(EMPTY_ANALYTICS_SNAPSHOT);
  const [mapPoints, setMapPoints] = useState(EMPTY_MAP_POINTS_RESULT);
  const [areaStatsByLevel, setAreaStatsByLevel] = useState<Partial<Record<MapLevel, MapAreaStat[]>>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isAnalyzeMode = mode === "analyze";
  const effectiveOverlayMode: MapOverlayMode = isAnalyzeMode ? "intensity" : overlayMode;
  const mapListings = useMemo(
    () => (mode === "browse" ? mapPoints.rows : []),
    [mapPoints.rows, mode]
  );
  const visibleCount = mode === "browse" ? mapPoints.returnedCount : stats.totalListings;
  const totalCount = mode === "browse" ? mapPoints.totalInBounds : stats.totalListings;

  useEffect(() => {
    if (isAnalyzeMode) {
      setOverlayMode("intensity");
      setSelectedListing(null);
      setIsDetailsOpen(false);
    }
  }, [isAnalyzeMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedBounds(bounds);
    }, 280);

    return () => {
      window.clearTimeout(timer);
    };
  }, [bounds]);

  useEffect(() => {
    let isCancelled = false;

    void fetchFilterOptions()
      .then((result) => {
        if (!isCancelled) {
          setFilterOptions(result);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setFilterOptions(EMPTY_FILTER_OPTIONS);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    const requestId = dataRequestRef.current + 1;
    dataRequestRef.current = requestId;
    setIsLoading(true);
    setError(null);

    const effectiveBounds = filters.in_view ? debouncedBounds : undefined;
    const pointsPromise = mode === "browse" && filters.district.length > 0
      ? fetchMapPoints(filters, effectiveBounds, 500)
      : Promise.resolve(EMPTY_MAP_POINTS_RESULT);

    void Promise.all([fetchListingsStats(filters, effectiveBounds), pointsPromise])
      .then(([nextStats, nextPoints]) => {
        if (dataRequestRef.current !== requestId) {
          return;
        }

        setStats(nextStats);
        setMapPoints(nextPoints);
      })
      .catch((nextError) => {
        if (dataRequestRef.current !== requestId) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load map data");
        setMapPoints(EMPTY_MAP_POINTS_RESULT);
      })
      .finally(() => {
        if (dataRequestRef.current === requestId) {
          setIsLoading(false);
        }
      });
  }, [debouncedBounds, filters, mode]);

  useEffect(() => {
    const requestId = areaRequestRef.current + 1;
    areaRequestRef.current = requestId;

    void Promise.all([
      fetchMapAreaStats(filters, "region"),
      fetchMapAreaStats(filters, "city", filters.region[0]),
      fetchMapAreaStats(filters, "district", filters.region[0], filters.city[0])
    ])
      .then(([regionStats, cityStats, districtStats]) => {
        if (areaRequestRef.current !== requestId) {
          return;
        }

        setAreaStatsByLevel({
          region: regionStats,
          city: cityStats,
          district: districtStats
        });
      })
      .catch((nextError) => {
        if (areaRequestRef.current !== requestId) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load map area stats");
      });
  }, [filters]);

  useEffect(() => {
    if (!router.isReady || mapInViewDefaultAppliedRef.current) {
      return;
    }

    mapInViewDefaultAppliedRef.current = true;
    const hasInViewParam = typeof router.query.in_view !== "undefined";

    if (!hasInViewParam) {
      setFilters({ in_view: true }, { resetPage: false });
    }
  }, [router.isReady, router.query.in_view, setFilters]);

  const openListingDetails = (listing: Listing) => {
    if (isAnalyzeMode) {
      return;
    }

    setSelectedListing(listing);
    setIsDetailsOpen(true);
  };

  return (
    <>
      <Head>
        <title>{messages.map.title}</title>
        <meta name="description" content={messages.map.description} />
        <link rel="alternate" hrefLang="en" href="/en/map/" />
        <link rel="alternate" hrefLang="ar" href="/ar/map/" />
      </Head>

      <ExplorerShell
        locale={locale}
        messages={messages}
        activePage="map"
        mode={mode}
        onModeChange={setMode}
        title={messages.map.title}
        description={messages.map.description}
        filterPanelDesktop={
          <FilterPanelDesktop
            locale={locale}
            messages={messages}
            filters={filters}
            options={filterOptions}
            onPatch={setFilters}
            onReset={resetFilters}
            showInViewToggle
          />
        }
        filterPanelMobile={
          <FilterPanelMobile
            locale={locale}
            messages={messages}
            filters={filters}
            options={filterOptions}
            onPatch={setFilters}
            onReset={resetFilters}
            showInViewToggle
          />
        }
        statsRow={<StatsRow locale={locale} messages={messages} snapshot={stats} />}
        hrefQuery={hrefQuery}
      >
        <AdPlaceholder variant="stats" />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative">
            <ListingsMap
              locale={locale}
              messages={messages}
              filters={filters}
              listings={mapListings}
              overlayMode={effectiveOverlayMode}
              mode={mode}
              areaStatsByLevel={areaStatsByLevel}
              onPatchFilters={setFilters}
              onSelectListing={openListingDetails}
              onViewportChange={setBounds}
            />
            {error ? (
              <div className="pointer-events-none absolute end-3 top-3 z-[1002] rounded-md border border-destructive/60 bg-background/90 px-2 py-1 text-[11px] text-destructive backdrop-blur">
                {error}
              </div>
            ) : isLoading ? (
              <div className="pointer-events-none absolute end-3 top-3 z-[1002] rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
                Updating map...
              </div>
            ) : null}
          </div>

          <MapLegend
            messages={messages}
            overlayMode={effectiveOverlayMode}
            onOverlayModeChange={setOverlayMode}
            isAnalyzeMode={isAnalyzeMode}
            visibleCount={visibleCount}
            totalCount={totalCount}
          />
        </div>
      </ExplorerShell>

      {isAnalyzeMode ? null : (
        <ListingDetailsDrawer
          locale={locale}
          messages={messages}
          listing={selectedListing}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      )}
    </>
  );
}
