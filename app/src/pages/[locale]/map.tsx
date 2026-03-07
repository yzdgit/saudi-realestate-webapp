import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import type { GetStaticPaths, GetStaticProps, InferGetStaticPropsType } from "next";
import { useRouter } from "next/router";
import { AdPlaceholder } from "@/components/ads/ad-placeholder";
import { ExplorerShell } from "@/components/layout/explorer-shell";
import { StatsRow } from "@/components/layout/stats-row";
import { ActiveFilterChips } from "@/features/filters/active-filter-chips";
import { FilterPanelDesktop, FilterPanelMobile } from "@/features/filters/filter-panel";
import { useUrlFilters } from "@/features/filters/use-url-filters";
import { ListingDetailsDrawer } from "@/features/listings/listing-details-drawer";
import { MapLegend } from "@/features/map/map-legend";
import type { MapOverlayMode } from "@/features/map/listings-map";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import { getFilterOptions, getMockListings } from "@/lib/realestate/mock-repository";
import { applyListingFilters, buildAnalyticsSnapshot } from "@/lib/realestate/pipeline";
import type { Listing, MapBounds } from "@/lib/realestate/types";
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

  const listings = useMemo(() => getMockListings(), []);
  const filterOptions = useMemo(() => getFilterOptions(listings), [listings]);

  const [bounds, setBounds] = useState<MapBounds | undefined>();
  const [overlayMode, setOverlayMode] = useState<MapOverlayMode>("markers");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isAnalyzeMode = mode === "analyze";
  const effectiveOverlayMode: MapOverlayMode = isAnalyzeMode ? "intensity" : overlayMode;

  const baseFiltered = useMemo(
    () => applyListingFilters(listings, { ...filters, in_view: false }),
    [filters, listings]
  );

  const viewportFiltered = useMemo(() => {
    if (!bounds) {
      return baseFiltered;
    }

    return applyListingFilters(baseFiltered, { ...filters, in_view: true }, bounds);
  }, [baseFiltered, bounds, filters]);

  const mapListings = filters.in_view ? viewportFiltered : baseFiltered;
  const stats = useMemo(() => buildAnalyticsSnapshot(mapListings), [mapListings]);

  useEffect(() => {
    if (isAnalyzeMode) {
      setOverlayMode("intensity");
      setSelectedListing(null);
      setIsDetailsOpen(false);
    }
  }, [isAnalyzeMode]);

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
        <AdPlaceholder variant="stats" />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <ListingsMap
            locale={locale}
            messages={messages}
            filters={filters}
            listings={mapListings}
            overlayMode={effectiveOverlayMode}
            mode={mode}
            onPatchFilters={setFilters}
            onSelectListing={openListingDetails}
            onViewportChange={setBounds}
          />

          <MapLegend
            messages={messages}
            overlayMode={effectiveOverlayMode}
            onOverlayModeChange={setOverlayMode}
            isAnalyzeMode={isAnalyzeMode}
            visibleCount={viewportFiltered.length}
            totalCount={baseFiltered.length}
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
