import { buildCacheKey, runCachedQuery } from "@/lib/queries/cache";
import { loadDataset } from "@/lib/realestate/dataset";
import {
  applyListingFilters,
  applySorting,
  buildAnalyticsSnapshot,
  buildGeoRankingRows,
  isInBounds,
  normalizeFilters,
  paginateListings
} from "@/lib/realestate/pipeline";
import type {
  AnalyticsSnapshot,
  FilterOptionSet,
  GeoRankingLevel,
  GeoRankingRow,
  Listing,
  ListingFilters,
  ListingGoal,
  ListingType,
  MapAreaStat,
  MapBounds,
  MapLevel,
  PropertyType,
  RentFrequency
} from "@/lib/realestate/types";

type AnyRecord = Record<string, unknown>;

type FetchOptions = {
  signal?: AbortSignal;
  ttlMs?: number;
};

export type ListingsBrowseResult = {
  rows: Listing[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MapPointsResult = {
  rows: Listing[];
  returnedCount: number;
  totalInBounds: number;
};

export type MapAreaStatsBundle = Record<MapLevel, MapAreaStat[]>;

export type AnalyzeSnapshotDailyResult = {
  snapshot: AnalyticsSnapshot;
  rankings: Record<GeoRankingLevel, GeoRankingRow[]>;
};

const LISTINGS_TTL_MS = 24 * 60 * 60 * 1000;
export const MV_TTL_MS = 12 * 60 * 60 * 1000;
const LISTINGS_BROWSE_PAGE_LIMIT = 10;
const MAP_POINTS_HARD_CAP = 500;

export const EMPTY_FILTER_OPTIONS: FilterOptionSet = {
  goal: [],
  rent_frequency: [],
  property_type: [],
  listing_type: [],
  region: [],
  city: [],
  district: []
};

export const EMPTY_ANALYTICS_SNAPSHOT: AnalyticsSnapshot = {
  totalListings: 0,
  medianPrice: 0,
  meanPrice: 0,
  minPrice: 0,
  maxPrice: 0,
  medianPricePerM2: 0,
  meanPricePerM2: 0,
  minPricePerM2: 0,
  maxPricePerM2: 0,
  medianArea: 0,
  meanArea: 0,
  minArea: 0,
  maxArea: 0,
  rentShare: 0,
  saleShare: 0,
  goalDistribution: [],
  propertyTypeByGoal: [],
  cityDistribution: [],
  districtAvgPricePerM2: [],
  priceHistogram: [],
  areaHistogram: [],
  scatter: [],
  cityGeo: []
};

export const EMPTY_LISTINGS_BROWSE_RESULT: ListingsBrowseResult = {
  rows: [],
  totalItems: 0,
  page: 1,
  pageSize: LISTINGS_BROWSE_PAGE_LIMIT,
  totalPages: 1
};

export const EMPTY_MAP_POINTS_RESULT: MapPointsResult = {
  rows: [],
  returnedCount: 0,
  totalInBounds: 0
};

export const EMPTY_MAP_AREA_STATS_BUNDLE: MapAreaStatsBundle = {
  region: [],
  city: [],
  district: []
};

export const EMPTY_ANALYZE_SNAPSHOT_DAILY_RESULT: AnalyzeSnapshotDailyResult = {
  snapshot: EMPTY_ANALYTICS_SNAPSHOT,
  rankings: {
    region: [],
    city: [],
    district: []
  }
};

export function stripNumericFilterValues(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    price_min: undefined,
    price_max: undefined,
    area_min: undefined,
    area_max: undefined,
    bedrooms_min: undefined,
    bathrooms_min: undefined,
    rooms_min: undefined
  };
}

function toFilterPayload(filters: ListingFilters, includeNumeric = true): AnyRecord {
  const payload: AnyRecord = {
    goal: filters.goal,
    listing_type: filters.listing_type,
    rent_frequency: filters.rent_frequency,
    property_type: filters.property_type,
    region: filters.region,
    city: filters.city,
    district: filters.district,
    in_view: filters.in_view
  };

  if (!includeNumeric) {
    return payload;
  }

  if (typeof filters.price_min === "number") {
    payload.price_min = filters.price_min;
  }
  if (typeof filters.price_max === "number") {
    payload.price_max = filters.price_max;
  }
  if (typeof filters.area_min === "number") {
    payload.area_min = filters.area_min;
  }
  if (typeof filters.area_max === "number") {
    payload.area_max = filters.area_max;
  }
  if (typeof filters.bedrooms_min === "number") {
    payload.bedrooms_min = filters.bedrooms_min;
  }
  if (typeof filters.bathrooms_min === "number") {
    payload.bathrooms_min = filters.bathrooms_min;
  }
  if (typeof filters.rooms_min === "number") {
    payload.rooms_min = filters.rooms_min;
  }

  return payload;
}

function toBoundsPayload(bounds: MapBounds | undefined): AnyRecord | null {
  if (!bounds) {
    return null;
  }
  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west
  };
}

function uniqueSorted<T extends string>(items: Iterable<T>): T[] {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right)) as T[];
}

function deriveFilterOptions(listings: Listing[]): FilterOptionSet {
  return {
    goal: uniqueSorted(listings.map((item) => item.goal as ListingGoal)),
    rent_frequency: uniqueSorted(
      listings
        .map((item) => item.rent_frequency)
        .filter((item): item is RentFrequency => Boolean(item))
    ),
    property_type: uniqueSorted(listings.map((item) => item.property_type as PropertyType)),
    listing_type: uniqueSorted(listings.map((item) => item.listing_type as ListingType)),
    region: uniqueSorted(listings.map((item) => item.region_code)),
    city: uniqueSorted(listings.map((item) => item.city_code)),
    district: uniqueSorted(listings.map((item) => item.district_code))
  };
}

function filterListingsWithBounds(
  listings: Listing[],
  filters: ListingFilters,
  bounds: MapBounds | undefined,
  forceBounds: boolean
): Listing[] {
  const filtered = applyListingFilters(listings, filters, forceBounds ? bounds : undefined);

  if (!forceBounds && filters.in_view && bounds) {
    return filtered.filter((item) => isInBounds(item.latitude, item.longitude, bounds));
  }

  return filtered;
}

export async function fetchFilterOptions(options: FetchOptions = {}): Promise<FilterOptionSet> {
  return runCachedQuery({
    key: buildCacheKey("static_filter_options"),
    ttlMs: options.ttlMs ?? MV_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const listings = await loadDataset(signal);
      return deriveFilterOptions(listings);
    }
  });
}

export async function fetchListingsBrowse(
  filters: ListingFilters,
  _pageSize: number,
  options: FetchOptions = {}
): Promise<ListingsBrowseResult> {
  const normalized = normalizeFilters(filters);
  const filterPayload = toFilterPayload(normalized, true);
  const requestedPage = Math.max(1, normalized.page);

  return runCachedQuery({
    key: buildCacheKey("select_listings_browse", {
      filters: filterPayload,
      sort: normalized.sort,
      page: requestedPage,
      pageSize: LISTINGS_BROWSE_PAGE_LIMIT
    }),
    ttlMs: options.ttlMs ?? LISTINGS_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const listings = await loadDataset(signal);
      const filtered = applyListingFilters(listings, normalized);
      const sorted = applySorting(filtered, normalized.sort);
      const paginated = paginateListings(sorted, requestedPage, LISTINGS_BROWSE_PAGE_LIMIT);

      return {
        rows: paginated.items,
        totalItems: paginated.totalItems,
        page: paginated.page,
        pageSize: paginated.pageSize,
        totalPages: paginated.totalPages
      };
    }
  });
}

export async function fetchKpiLive(
  filters: ListingFilters,
  bounds?: MapBounds,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  const normalized = normalizeFilters(filters);
  const filterPayload = toFilterPayload(normalized, true);

  return runCachedQuery({
    key: buildCacheKey("static_kpi_live", {
      filters: filterPayload,
      bounds: toBoundsPayload(bounds)
    }),
    ttlMs: options.ttlMs ?? LISTINGS_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const listings = await loadDataset(signal);
      const filtered = filterListingsWithBounds(listings, normalized, bounds, false);
      return buildAnalyticsSnapshot(filtered);
    }
  });
}

export async function fetchKpiDaily(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  return fetchKpiLive(stripNumericFilterValues(filters), undefined, options);
}

export async function fetchListingsStats(
  filters: ListingFilters,
  bounds?: MapBounds,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  return fetchKpiLive(filters, bounds, options);
}

export async function fetchAnalyzeSnapshotDaily(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<AnalyzeSnapshotDailyResult> {
  const normalized = normalizeFilters(filters);
  const filterPayload = toFilterPayload(normalized, true);

  return runCachedQuery({
    key: buildCacheKey("static_analyze_snapshot_daily", { filters: filterPayload }),
    ttlMs: options.ttlMs ?? MV_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const listings = await loadDataset(signal);
      const filtered = applyListingFilters(listings, normalized);

      return {
        snapshot: buildAnalyticsSnapshot(filtered),
        rankings: {
          region: buildGeoRankingRows(filtered, "region"),
          city: buildGeoRankingRows(filtered, "city"),
          district: buildGeoRankingRows(filtered, "district")
        }
      };
    }
  });
}

export async function fetchGeoRankings(
  filters: ListingFilters,
  level: GeoRankingLevel,
  options: FetchOptions = {}
): Promise<GeoRankingRow[]> {
  const result = await fetchAnalyzeSnapshotDaily(filters, options);
  return result.rankings[level];
}

export async function fetchMapPoints(
  filters: ListingFilters,
  bounds: MapBounds | undefined,
  limit = MAP_POINTS_HARD_CAP,
  options: FetchOptions = {}
): Promise<MapPointsResult> {
  if (!bounds) {
    return EMPTY_MAP_POINTS_RESULT;
  }

  const normalized = normalizeFilters(filters);
  const cappedLimit = Math.min(Math.max(1, Math.trunc(limit)), MAP_POINTS_HARD_CAP);
  const filterPayload = toFilterPayload(normalized, true);

  return runCachedQuery({
    key: buildCacheKey("select_map_points", {
      filters: filterPayload,
      bounds: toBoundsPayload(bounds),
      limit: cappedLimit
    }),
    ttlMs: options.ttlMs ?? LISTINGS_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const listings = await loadDataset(signal);
      const filtered = filterListingsWithBounds(listings, normalized, bounds, true);
      const sorted = applySorting(filtered, "newest");
      const rows = sorted.slice(0, cappedLimit);

      return {
        rows,
        returnedCount: rows.length,
        totalInBounds: filtered.length
      };
    }
  });
}

function rankingsToAreaStats(rankings: GeoRankingRow[], level: MapLevel): MapAreaStat[] {
  return rankings.map((row) => ({
    level,
    code: row.code,
    totalListings: row.count,
    meanPrice: row.meanPrice,
    medianPrice: row.medianPrice,
    meanPricePerM2: row.meanPricePerM2,
    medianPricePerM2: row.medianPricePerM2,
    rentShare: row.rentShare,
    saleShare: row.saleShare
  }));
}

export async function fetchMapAreaStatsDailyBundle(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<MapAreaStatsBundle> {
  const result = await fetchAnalyzeSnapshotDaily(filters, options);

  return {
    region: rankingsToAreaStats(result.rankings.region, "region"),
    city: rankingsToAreaStats(result.rankings.city, "city"),
    district: rankingsToAreaStats(result.rankings.district, "district")
  };
}

export async function fetchMapAreaStats(
  filters: ListingFilters,
  level: GeoRankingLevel,
  _regionCode?: string,
  _cityCode?: string,
  options: FetchOptions = {}
): Promise<MapAreaStat[]> {
  const bundle = await fetchMapAreaStatsDailyBundle(filters, options);
  return bundle[level];
}

export async function fetchLatestListings(limit = LISTINGS_BROWSE_PAGE_LIMIT): Promise<Listing[]> {
  const fallbackFilters: ListingFilters = {
    goal: "sale",
    rent_frequency: [],
    property_type: [],
    listing_type: "residential",
    region: [],
    city: [],
    district: [],
    sort: "newest",
    page: 1,
    in_view: false
  };

  const browse = await fetchListingsBrowse(fallbackFilters, limit);
  return browse.rows;
}
