import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { AdPlaceholder } from "@/components/ads/ad-placeholder";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveFilterChips } from "@/features/filters/active-filter-chips";
import { FilterPanelDesktop, FilterPanelMobile } from "@/features/filters/filter-panel";
import { useUrlFilters } from "@/features/filters/use-url-filters";
import { CompareStrip } from "@/features/listings/compare-strip";
import { ListingDetailsDrawer } from "@/features/listings/listing-details-drawer";
import { ListingsEmptyState } from "@/features/listings/listings-empty-state";
import { PaginationControls } from "@/features/listings/pagination-controls";
import { ListingsTable } from "@/features/listings/listings-table";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import {
  EMPTY_ANALYTICS_SNAPSHOT,
  EMPTY_ANALYZE_SNAPSHOT_DAILY_RESULT,
  EMPTY_LISTINGS_BROWSE_RESULT,
  fetchAnalyzeSnapshotDaily,
  fetchListingsBrowse,
  fetchKpiLive
} from "@/lib/queries/realestate";
import { DEFAULT_PAGE_SIZE, getGeoDrillLevel } from "@/lib/realestate/pipeline";
import { HARDCODED_FILTER_OPTIONS } from "@/lib/realestate/hardcoded-filter-options";
import type { GeoRankingRow, Listing } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

const ListingsAnalyzeView = dynamic(
  () => import("@/features/analyze/listings-analyze-view").then((module) => module.ListingsAnalyzeView),
  {
    ssr: false,
    loading: () => (
      <Card className="border-border/70 bg-card/80">
        <CardContent className="py-4 text-sm text-muted-foreground">Loading analytics...</CardContent>
      </Card>
    )
  }
);

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function ListingsPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const messages = getMessages(locale);
  const { mode, setMode, filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);

  const [stats, setStats] = useState(EMPTY_ANALYTICS_SNAPSHOT);
  const [browseResult, setBrowseResult] = useState(EMPTY_LISTINGS_BROWSE_RESULT);
  const [rankingRows, setRankingRows] = useState<GeoRankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [compareById, setCompareById] = useState<Record<string, Listing>>({});

  const compareIds = useMemo(() => Object.keys(compareById), [compareById]);
  const compareListings = useMemo(() => Object.values(compareById), [compareById]);
  const drillLevel = useMemo(() => getGeoDrillLevel(filters), [filters]);
  const isAbortError = (error: unknown) => error instanceof Error && error.name === "AbortError";

  useEffect(() => {
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

    if (mode === "browse") {
      void Promise.all([
        fetchKpiLive(filters, undefined, { signal: controller.signal }),
        fetchListingsBrowse(filters, DEFAULT_PAGE_SIZE, { signal: controller.signal })
      ])
        .then(([nextStats, nextBrowse]) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          setStats(nextStats);
          setBrowseResult(nextBrowse);
          setRankingRows([]);
        })
        .catch((nextError) => {
          if (requestIdRef.current !== requestId) {
            return;
          }

          if (controller.signal.aborted) {
            return;
          }

          if (isAbortError(nextError)) {
            return;
          }

          setError(nextError instanceof Error ? nextError.message : "Failed to load listings");
          setBrowseResult(EMPTY_LISTINGS_BROWSE_RESULT);
        })
        .finally(() => {
          if (requestIdRef.current === requestId) {
            setIsLoading(false);
          }
        });

      return () => {
        controller.abort();
      };
    }

    void fetchAnalyzeSnapshotDaily(filters, { signal: controller.signal })
      .then((result) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        const nextStats = result ?? EMPTY_ANALYZE_SNAPSHOT_DAILY_RESULT;
        setStats(nextStats.snapshot);
        setRankingRows(nextStats.rankings[drillLevel] ?? []);
      })
      .catch((nextError) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (controller.signal.aborted) {
          return;
        }

        if (isAbortError(nextError)) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : "Failed to load listings analytics");
        setRankingRows([]);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [drillLevel, filters, mode]);

  const openListingDetails = (listing: Listing) => {
    setSelectedListing(listing);
    setIsDetailsOpen(true);
  };

  const toggleCompare = (listing: Listing) => {
    setCompareById((current) => {
      if (current[listing.id]) {
        const next = { ...current };
        delete next[listing.id];
        return next;
      }

      if (Object.keys(current).length >= 3) {
        return current;
      }

      return {
        ...current,
        [listing.id]: listing
      };
    });
  };

  return (
    <>
      <Head>
        <title>{messages.listings.title}</title>
        <meta name="description" content={messages.listings.description} />
        <link rel="alternate" hrefLang="en" href="/en/listings/" />
        <link rel="alternate" hrefLang="ar" href="/ar/listings/" />
      </Head>

      <ExplorerShell
        locale={locale}
        messages={messages}
        activePage="listings"
        mode={mode}
        onModeChange={setMode}
        title={messages.listings.title}
        description={messages.listings.description}
        filterPanelDesktop={
          <FilterPanelDesktop
            locale={locale}
            messages={messages}
            filters={filters}
            options={HARDCODED_FILTER_OPTIONS}
            onPatch={setFilters}
            onReset={resetFilters}
            disableNumericFilters={mode === "analyze"}
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
            disableNumericFilters={mode === "analyze"}
          />
        }
        activeFilterChips={
          <ActiveFilterChips
            locale={locale}
            messages={messages}
            filters={filters}
            onPatch={setFilters}
            onReset={resetFilters}
          />
        }
        statsRow={<StatsRow locale={locale} messages={messages} snapshot={stats} />}
        hrefQuery={hrefQuery}
      >
        {error ? (
          <Card className="border-destructive/40 bg-card/80">
            <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {mode === "browse" ? (
          <>
            <CompareStrip
              locale={locale}
              messages={messages}
              items={compareListings}
              onRemove={(listingId) =>
                setCompareById((current) => {
                  const next = { ...current };
                  delete next[listingId];
                  return next;
                })
              }
              onClear={() => setCompareById({})}
            />

            <AdPlaceholder variant="table" />

            {isLoading && browseResult.rows.length === 0 ? (
              <Card className="border-border/70 bg-card/80">
                <CardContent className="py-4 text-sm text-muted-foreground">Loading listings...</CardContent>
              </Card>
            ) : browseResult.totalItems === 0 ? (
              <ListingsEmptyState messages={messages} onReset={resetFilters} />
            ) : (
              <ListingsTable
                locale={locale}
                messages={messages}
                listings={browseResult.rows}
                compareIds={compareIds}
                onSelect={openListingDetails}
                onToggleCompare={toggleCompare}
              />
            )}

            <PaginationControls
              messages={messages}
              page={browseResult.page}
              totalPages={browseResult.totalPages}
              onPageChange={(page) => setFilters({ page }, { resetPage: false })}
            />
          </>
        ) : (
          <>
            <AdPlaceholder variant="stats" />
            {isLoading && stats.totalListings === 0 ? (
              <Card className="border-border/70 bg-card/80">
                <CardContent className="py-4 text-sm text-muted-foreground">Loading analytics...</CardContent>
              </Card>
            ) : stats.totalListings === 0 ? (
              <ListingsEmptyState messages={messages} onReset={resetFilters} />
            ) : (
              <ListingsAnalyzeView
                locale={locale}
                messages={messages}
                filters={filters}
                drillLevel={drillLevel}
                snapshot={stats}
                rankingRows={rankingRows}
                onPatchFilters={setFilters}
              />
            )}
          </>
        )}
      </ExplorerShell>

      {mode === "browse" ? (
        <ListingDetailsDrawer
          locale={locale}
          messages={messages}
          listing={selectedListing}
          open={isDetailsOpen}
          onOpenChange={setIsDetailsOpen}
        />
      ) : null}
    </>
  );
}
