import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
import { AnalyticsSkeleton } from "@/features/analyze/analytics-skeleton";
import { ListingsEmptyState } from "@/features/listings/listings-empty-state";
import { localeStaticPaths, localeStaticProps, type LocalePageProps } from "@/lib/locale-static";
import { getMessages } from "@/lib/messages";
import {
  EMPTY_ANALYTICS_SNAPSHOT,
  EMPTY_ANALYZE_SNAPSHOT_DAILY_RESULT,
  fetchAnalyzeSnapshotDaily
} from "@/lib/queries/realestate";
import { isAbortLikeError } from "@/lib/queries/cache";
import { getGeoDrillLevel } from "@/lib/realestate/pipeline";
import { HARDCODED_FILTER_OPTIONS } from "@/lib/realestate/hardcoded-filter-options";
import type { GeoRankingRow } from "@/lib/realestate/types";
import { useLocaleDocument } from "@/lib/use-locale-document";

const ListingsAnalyzeView = dynamic(
  () => import("@/features/analyze/listings-analyze-view").then((module) => module.ListingsAnalyzeView),
  {
    ssr: false,
    loading: () => <AnalyticsSkeleton />
  }
);

export const getStaticPaths: GetStaticPaths = localeStaticPaths;

export const getStaticProps: GetStaticProps<LocalePageProps> = async (context) => localeStaticProps(context);

export default function StatisticsPage({ locale }: InferGetStaticPropsType<typeof getStaticProps>) {
  useLocaleDocument(locale);

  const router = useRouter();
  const messages = getMessages(locale);
  const { filters, setFilters, resetFilters, hrefQuery } = useUrlFilters(locale);

  const [stats, setStats] = useState(EMPTY_ANALYTICS_SNAPSHOT);
  const [rankingRows, setRankingRows] = useState<GeoRankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const drillLevel = useMemo(() => getGeoDrillLevel(filters), [filters]);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setIsLoading(true);
    setError(null);

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

        if (isAbortLikeError(nextError)) {
          return;
        }

        setError(nextError instanceof Error ? nextError.message : messages.errors.load_analytics);
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
  }, [drillLevel, filters, router.isReady, messages.errors.load_analytics]);

  return (
    <>
      <Head>
        <title>{messages.analytics.title}</title>
        <meta name="description" content={messages.analytics.description} />
        <link rel="alternate" hrefLang="en" href="/en/statistics/" />
        <link rel="alternate" hrefLang="ar" href="/ar/statistics/" />
        <link rel="preload" href="/static-data/listings.json" as="fetch" crossOrigin="anonymous" />
      </Head>

      <ErrorBoundary
        title={messages.errors.boundary_title}
        description={messages.errors.boundary_description}
        actionLabel={messages.errors.boundary_action}
      >
        <ExplorerShell
          locale={locale}
          messages={messages}
          activePage="statistics"
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

          {isLoading && stats.totalListings === 0 ? (
            <AnalyticsSkeleton />
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
        </ExplorerShell>
      </ErrorBoundary>
    </>
  );
}
