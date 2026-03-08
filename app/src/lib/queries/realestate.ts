import { buildCacheKey, isAbortLikeError, runCachedQuery } from "@/lib/queries/cache";
import type {
  AnalyticsSnapshot,
  FilterOptionSet,
  GeoRankingLevel,
  GeoRankingRow,
  Listing,
  ListingFilters,
  MapAreaStat,
  MapBounds,
  MapLevel
} from "@/lib/realestate/types";
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from "@/lib/supabase";

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

const DAY_TTL_MS = 24 * 60 * 60 * 1000;
const LISTINGS_BROWSE_PAGE_LIMIT = 10;

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

const toNumber = (value: unknown, fallback = 0): number => {
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1" || normalized === "t";
  }

  return false;
};

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
};

const toRecord = (value: unknown): AnyRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as AnyRecord;
};

const toRecordArray = (value: unknown): AnyRecord[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => toRecord(item))
    .filter((item) => Object.keys(item).length > 0);
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

const toFilterPayload = (filters: ListingFilters, includeNumeric = true): AnyRecord => {
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
};

const toBoundsPayload = (bounds: MapBounds | undefined): AnyRecord | null => {
  if (!bounds) {
    return null;
  }

  return {
    north: bounds.north,
    south: bounds.south,
    east: bounds.east,
    west: bounds.west
  };
};

const toListing = (row: AnyRecord): Listing => {
  const rentFrequencyRaw =
    typeof row.rent_frequency === "string" ? row.rent_frequency : undefined;

  return {
    id: String(row.id ?? ""),
    source: String(row.source ?? "aqar") as Listing["source"],
    listing_uri: String(row.listing_uri ?? ""),
    goal: String(row.goal ?? "sale") as Listing["goal"],
    rent_frequency: rentFrequencyRaw as Listing["rent_frequency"],
    raw_rent_frequency: rentFrequencyRaw as Listing["raw_rent_frequency"],
    price: toNumber(row.price),
    area: toNumber(row.area_m2),
    rooms: toNullableNumber(row.rooms) ?? undefined,
    bedrooms: toNullableNumber(row.bedrooms) ?? undefined,
    bathrooms: toNullableNumber(row.bathrooms) ?? undefined,
    living_rooms: toNullableNumber(row.living_rooms) ?? undefined,
    property_type: String(row.property_type ?? "other") as Listing["property_type"],
    listing_type: String(row.listing_type ?? "residential") as Listing["listing_type"],
    region_code: String(row.region_code ?? ""),
    city_code: String(row.city_code ?? ""),
    district_code: String(row.district_code ?? ""),
    latitude: toNumber(row.latitude),
    longitude: toNumber(row.longitude),
    price_per_m2: toNullableNumber(row.price_per_m2),
    is_outlier: toBoolean(row.is_outlier)
  };
};

const toSnapshot = (payload: unknown): AnalyticsSnapshot => {
  const value = toRecord(payload);

  return {
    totalListings: toNumber(value.totalListings),
    medianPrice: toNumber(value.medianPrice),
    meanPrice: toNumber(value.meanPrice),
    minPrice: toNumber(value.minPrice),
    maxPrice: toNumber(value.maxPrice),
    medianPricePerM2: toNumber(value.medianPricePerM2),
    meanPricePerM2: toNumber(value.meanPricePerM2),
    minPricePerM2: toNumber(value.minPricePerM2),
    maxPricePerM2: toNumber(value.maxPricePerM2),
    medianArea: toNumber(value.medianArea),
    meanArea: toNumber(value.meanArea),
    minArea: toNumber(value.minArea),
    maxArea: toNumber(value.maxArea),
    rentShare: toNumber(value.rentShare),
    saleShare: toNumber(value.saleShare),
    goalDistribution: Array.isArray(value.goalDistribution)
      ? (value.goalDistribution as AnalyticsSnapshot["goalDistribution"])
      : [],
    propertyTypeByGoal: Array.isArray(value.propertyTypeByGoal)
      ? (value.propertyTypeByGoal as AnalyticsSnapshot["propertyTypeByGoal"])
      : [],
    cityDistribution: Array.isArray(value.cityDistribution)
      ? (value.cityDistribution as AnalyticsSnapshot["cityDistribution"])
      : [],
    districtAvgPricePerM2: Array.isArray(value.districtAvgPricePerM2)
      ? (value.districtAvgPricePerM2 as AnalyticsSnapshot["districtAvgPricePerM2"])
      : [],
    priceHistogram: Array.isArray(value.priceHistogram)
      ? (value.priceHistogram as AnalyticsSnapshot["priceHistogram"])
      : [],
    areaHistogram: Array.isArray(value.areaHistogram)
      ? (value.areaHistogram as AnalyticsSnapshot["areaHistogram"])
      : [],
    scatter: Array.isArray(value.scatter)
      ? (value.scatter as AnalyticsSnapshot["scatter"])
      : [],
    cityGeo: Array.isArray(value.cityGeo)
      ? (value.cityGeo as AnalyticsSnapshot["cityGeo"])
      : []
  };
};

const toGeoRankingRows = (value: unknown, fallbackLevel: GeoRankingLevel): GeoRankingRow[] => {
  return toRecordArray(value).map((item) => ({
    code: String(item.code ?? ""),
    level: String(item.level ?? fallbackLevel) as GeoRankingLevel,
    count: toNumber(item.count),
    meanPrice: toNumber(item.meanPrice),
    medianPrice: toNumber(item.medianPrice),
    meanPricePerM2: toNumber(item.meanPricePerM2),
    medianPricePerM2: toNumber(item.medianPricePerM2),
    rentShare: toNumber(item.rentShare),
    saleShare: toNumber(item.saleShare)
  }));
};

const toMapAreaStats = (value: unknown, level: MapLevel): MapAreaStat[] => {
  return toRecordArray(value).map((item) => ({
    level: String(item.level ?? level) as MapAreaStat["level"],
    code: String(item.code ?? ""),
    totalListings: toNumber(item.totalListings),
    meanPrice: toNumber(item.meanPrice),
    medianPrice: toNumber(item.medianPrice),
    meanPricePerM2: toNumber(item.meanPricePerM2),
    medianPricePerM2: toNumber(item.medianPricePerM2),
    rentShare: toNumber(item.rentShare),
    saleShare: toNumber(item.saleShare)
  }));
};

const createAbortError = (): Error => {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }

  const fallback = new Error("Aborted");
  fallback.name = "AbortError";
  return fallback;
};

const handleRpcError = (error: { message?: string } | null): never | void => {
  if (!error) {
    return;
  }

  if (isAbortLikeError(error)) {
    throw createAbortError();
  }

  throw new Error(error.message ?? "Supabase RPC request failed");
};

const isMissingApiKeyError = (error: { message?: string } | null | undefined): boolean => {
  const message = error?.message ?? "";
  return message.includes("No API key found in request");
};

const runRpcOnce = async (
  fn: string,
  args: AnyRecord | undefined,
  signal?: AbortSignal
): Promise<{ data: unknown; error: { message?: string } | null }> => {
  const supabase = getSupabaseBrowserClient() as any;
  let request = typeof args === "undefined" ? supabase.rpc(fn) : supabase.rpc(fn, args);

  if (signal && request && typeof request.abortSignal === "function") {
    request = request.abortSignal(signal);
  }

  const { data, error } = await request;
  return { data, error };
};

const rpc = async (
  fn: string,
  args: AnyRecord | undefined,
  signal?: AbortSignal
): Promise<unknown> => {
  const firstAttempt = await runRpcOnce(fn, args, signal);

  if (isMissingApiKeyError(firstAttempt.error)) {
    resetSupabaseBrowserClient();
    const retryAttempt = await runRpcOnce(fn, args, signal);
    handleRpcError(retryAttempt.error);
    return retryAttempt.data;
  }

  const { data, error } = firstAttempt;
  handleRpcError(error);
  return data;
};

export async function fetchFilterOptions(options: FetchOptions = {}): Promise<FilterOptionSet> {
  return runCachedQuery({
    key: buildCacheKey("rpc_filter_options"),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc("rpc_filter_options", undefined, signal);
      const payload = toRecord(data);

      return {
        goal: toStringArray(payload.goal) as FilterOptionSet["goal"],
        rent_frequency: toStringArray(payload.rent_frequency) as FilterOptionSet["rent_frequency"],
        property_type: toStringArray(payload.property_type) as FilterOptionSet["property_type"],
        listing_type: toStringArray(payload.listing_type) as FilterOptionSet["listing_type"],
        region: toStringArray(payload.region),
        city: toStringArray(payload.city),
        district: toStringArray(payload.district)
      };
    }
  });
}

export async function fetchListingsBrowse(
  filters: ListingFilters,
  _pageSize: number,
  options: FetchOptions = {}
): Promise<ListingsBrowseResult> {
  const filterPayload = toFilterPayload(filters, true);

  return runCachedQuery({
    key: buildCacheKey("rpc_listings_browse", {
      filters: filterPayload,
      sort: filters.sort,
      page: filters.page,
      pageSize: LISTINGS_BROWSE_PAGE_LIMIT
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_listings_browse",
        {
          p_filters: filterPayload,
          p_sort: filters.sort,
          p_page: filters.page,
          p_page_size: LISTINGS_BROWSE_PAGE_LIMIT
        },
        signal
      );
      const payload = toRecord(data);
      const rows = toRecordArray(payload.rows).map(toListing);

      return {
        rows,
        totalItems: toNumber(payload.total_items),
        page: Math.max(1, toNumber(payload.page, 1)),
        pageSize: Math.max(1, toNumber(payload.page_size, LISTINGS_BROWSE_PAGE_LIMIT)),
        totalPages: Math.max(1, toNumber(payload.total_pages, 1))
      };
    }
  });
}

export async function fetchKpiLive(
  filters: ListingFilters,
  bounds?: MapBounds,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  const filterPayload = toFilterPayload(filters, true);
  const boundsPayload = toBoundsPayload(bounds);

  return runCachedQuery({
    key: buildCacheKey("rpc_kpi_live", {
      filters: filterPayload,
      bounds: boundsPayload
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_kpi_live",
        {
          p_filters: filterPayload,
          p_bounds: boundsPayload
        },
        signal
      );
      return toSnapshot(data);
    }
  });
}

export async function fetchKpiDaily(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  const analyticsFilters = stripNumericFilterValues(filters);
  const filterPayload = toFilterPayload(analyticsFilters, false);

  return runCachedQuery({
    key: buildCacheKey("rpc_kpi_daily", {
      filters: filterPayload
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_kpi_daily",
        {
          p_filters: filterPayload
        },
        signal
      );
      return toSnapshot(data);
    }
  });
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
  const analyticsFilters = stripNumericFilterValues(filters);
  const filterPayload = toFilterPayload(analyticsFilters, false);

  return runCachedQuery({
    key: buildCacheKey("rpc_analyze_snapshot_daily", {
      filters: filterPayload
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_analyze_snapshot_daily",
        {
          p_filters: filterPayload
        },
        signal
      );
      const payload = toRecord(data);

      return {
        snapshot: toSnapshot(payload),
        rankings: {
          region: toGeoRankingRows(payload.rankingsRegion, "region"),
          city: toGeoRankingRows(payload.rankingsCity, "city"),
          district: toGeoRankingRows(payload.rankingsDistrict, "district")
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
  limit = 500,
  options: FetchOptions = {}
): Promise<MapPointsResult> {
  const filterPayload = toFilterPayload(filters, true);
  const boundsPayload = toBoundsPayload(bounds);

  return runCachedQuery({
    key: buildCacheKey("rpc_map_points", {
      filters: filterPayload,
      bounds: boundsPayload,
      limit
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_map_points",
        {
          p_filters: filterPayload,
          p_bounds: boundsPayload,
          p_limit: limit
        },
        signal
      );
      const payload = toRecord(data);

      return {
        rows: toRecordArray(payload.rows).map(toListing),
        returnedCount: toNumber(payload.returned_count),
        totalInBounds: toNumber(payload.total_in_bounds)
      };
    }
  });
}

export async function fetchMapAreaStatsDailyBundle(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<MapAreaStatsBundle> {
  const analyticsFilters = stripNumericFilterValues(filters);
  const filterPayload = toFilterPayload(analyticsFilters, false);

  return runCachedQuery({
    key: buildCacheKey("rpc_map_area_stats_daily_bundle", {
      filters: filterPayload
    }),
    ttlMs: options.ttlMs ?? DAY_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const data = await rpc(
        "rpc_map_area_stats_daily_bundle",
        {
          p_filters: filterPayload
        },
        signal
      );
      const payload = toRecord(data);

      return {
        region: toMapAreaStats(payload.region, "region"),
        city: toMapAreaStats(payload.city, "city"),
        district: toMapAreaStats(payload.district, "district")
      };
    }
  });
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
