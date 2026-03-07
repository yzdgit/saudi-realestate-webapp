import { useMemo, useState } from "react";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { AdPlaceholder } from "@/components/ads/ad-placeholder";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { ListingsAnalyzeView } from "@/features/analyze/listings-analyze-view";
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
import { getFilterOptions, getMockListings } from "@/lib/realestate/mock-repository";
import {
  DEFAULT_PAGE_SIZE,
  applyListingFilters,
  applySorting,
  buildAnalyticsSnapshot,
  paginateListings
} from "@/lib/realestate/pipeline";
import type { Listing } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function ListingsPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const messages = getMessages(locale);
  const { mode, setMode, filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);

  const listings = useMemo(() => getMockListings(), []);
  const filterOptions = useMemo(() => getFilterOptions(listings), [listings]);

  const filteredListings = useMemo(
    () => applyListingFilters(listings, filters),
    [filters, listings]
  );

  const sortedListings = useMemo(
    () => applySorting(filteredListings, filters.sort),
    [filteredListings, filters.sort]
  );

  const pageSize = DEFAULT_PAGE_SIZE;
  const pagination = useMemo(
    () => paginateListings(sortedListings, filters.page, pageSize),
    [filters.page, pageSize, sortedListings]
  );

  const stats = useMemo(() => buildAnalyticsSnapshot(filteredListings), [filteredListings]);

  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const compareListings = useMemo(
    () => listings.filter((item) => compareIds.includes(item.id)),
    [compareIds, listings]
  );

  const openListingDetails = (listing: Listing) => {
    setSelectedListing(listing);
    setIsDetailsOpen(true);
  };

  const toggleCompare = (listing: Listing) => {
    setCompareIds((current) => {
      if (current.includes(listing.id)) {
        return current.filter((id) => id !== listing.id);
      }

      if (current.length >= 3) {
        return current;
      }

      return [...current, listing.id];
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
            options={filterOptions}
            onPatch={setFilters}
            onReset={resetFilters}
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
        {mode === "browse" ? (
          <>
            <CompareStrip
              locale={locale}
              messages={messages}
              items={compareListings}
              onRemove={(listingId) => setCompareIds((current) => current.filter((id) => id !== listingId))}
              onClear={() => setCompareIds([])}
            />

            <AdPlaceholder variant="table" />

            {pagination.totalItems === 0 ? (
              <ListingsEmptyState messages={messages} onReset={resetFilters} />
            ) : (
              <ListingsTable
                locale={locale}
                messages={messages}
                listings={pagination.items}
                compareIds={compareIds}
                onSelect={openListingDetails}
                onToggleCompare={toggleCompare}
              />
            )}

            <PaginationControls
              messages={messages}
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(page) => setFilters({ page }, { resetPage: false })}
            />
          </>
        ) : (
          <>
            <AdPlaceholder variant="stats" />
            {filteredListings.length === 0 ? (
              <ListingsEmptyState messages={messages} onReset={resetFilters} />
            ) : (
              <ListingsAnalyzeView
                locale={locale}
                messages={messages}
                filters={filters}
                listings={filteredListings}
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
