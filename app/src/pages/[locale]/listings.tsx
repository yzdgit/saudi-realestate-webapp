import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { useRouter } from "next/router";
import { AlertTriangle } from "lucide-react";
import { ErrorBoundary } from "@/components/layout/error-boundary";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveFilterChips } from "@/features/filters/active-filter-chips";
import { FilterPanelDesktop, FilterPanelMobile } from "@/features/filters/filter-panel";
import { useUrlFilters } from "@/features/filters/use-url-filters";
import { CompareStrip } from "@/features/listings/compare-strip";
import { ListingDetailsDrawer } from "@/features/listings/listing-details-drawer";
import { ListingsEmptyState } from "@/features/listings/listings-empty-state";
import { ListingsTableSkeleton } from "@/features/listings/listings-table-skeleton";
import { PaginationControls } from "@/features/listings/pagination-controls";
import { ListingsTable } from "@/features/listings/listings-table";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import {
  EMPTY_ANALYTICS_SNAPSHOT,
  EMPTY_LISTINGS_BROWSE_RESULT,
  fetchListingsBrowse,
  fetchKpiLive
} from "@/lib/queries/realestate";
import { isAbortLikeError } from "@/lib/queries/cache";
import { DEFAULT_PAGE_SIZE } from "@/lib/realestate/pipeline";
import { HARDCODED_FILTER_OPTIONS } from "@/lib/realestate/hardcoded-filter-options";
import type { Listing } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function ListingsPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const router = useRouter();
  const messages = getMessages(locale);
  const { filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);

  const [stats, setStats] = useState(EMPTY_ANALYTICS_SNAPSHOT);
  const [browseResult, setBrowseResult] = useState(EMPTY_LISTINGS_BROWSE_RESULT);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [compareById, setCompareById] = useState<Record<string, Listing>>({});

  const compareIds = useMemo(() => Object.keys(compareById), [compareById]);
  const compareListings = useMemo(() => Object.values(compareById), [compareById]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

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
      })
      .catch((nextError) => {
        if (requestIdRef.current !== requestId) {
          return;
        }

        if (controller.signal.aborted) {
          return;
        }

        if (isAbortLikeError(nextError)) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : messages.errors.load_listings);
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
  }, [filters, router.isReady, messages.errors.load_listings]);

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

      <ErrorBoundary
        title={messages.errors.boundary_title}
        description={messages.errors.boundary_description}
        actionLabel={messages.errors.boundary_action}
      >
        <ExplorerShell
          locale={locale}
          messages={messages}
          activePage="listings"
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
              <CardContent className="flex items-center gap-2 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                <span>{error}</span>
              </CardContent>
            </Card>
          ) : null}

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

          {isLoading && browseResult.rows.length === 0 ? (
            <ListingsTableSkeleton />
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
        </ExplorerShell>
      </ErrorBoundary>

      <ListingDetailsDrawer
        locale={locale}
        messages={messages}
        listing={selectedListing}
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
      />
    </>
  );
}
