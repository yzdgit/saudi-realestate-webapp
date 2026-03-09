import { buildCacheKey, isAbortLikeError, runCachedQuery } from "@/lib/queries/cache";
import {
  buildAnalyticsSnapshot,
  buildGeoRankingRows,
  normalizeFilters
} from "@/lib/realestate/pipeline";
import type {
  AnalyticsSnapshot,
  FilterOptionSet,
  GeoRankingLevel,
  GeoRankingRow,
  Listing,
  ListingFilters,
  ListingSort,
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

type SupabaseErrorLike = {
  message?: string;
};

type SupabaseResult<T> = {
  data: T;
  error: SupabaseErrorLike | null;
  count?: number | null;
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
const SNAPSHOT_BATCH_SIZE = 1000;

const LISTING_SELECT_COLUMNS = [
  "id",
  "source",
  "listing_uri",
  "goal",
  "rent_frequency",
  "price",
  "area_m2",
  "rooms",
  "bedrooms",
  "bathrooms",
  "living_rooms",
  "property_type",
  "listing_type",
  "region_code",
  "city_code",
  "district_code",
  "latitude",
  "longitude",
  "price_per_m2",
  "is_outlier"
].join(",");

const SNAPSHOT_SELECT_COLUMNS = [
  "id",
  "source",
  "listing_uri",
  "goal",
  "rent_frequency",
  "price",
  "area_m2",
  "rooms",
  "bedrooms",
  "bathrooms",
  "living_rooms",
  "property_type",
  "listing_type",
  "region_code",
  "city_code",
  "district_code",
  "latitude",
  "longitude",
  "price_per_m2",
  "is_outlier",
  "listed_at"
].join(",");

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

const normalizeListingUri = (source: Listing["source"], uri: string): string => {
  if (!uri) {
    return uri;
  }

  try {
    const parsed = new URL(uri);
    const hostname = parsed.hostname.toLowerCase();
    const isBayutHost = hostname === "bayut.sa" || hostname.endsWith(".bayut.sa");

    if (source !== "bayut" || !isBayutHost) {
      return uri;
    }

    const pathname = parsed.pathname;
    const lastSegment = pathname.split("/").pop() ?? "";
    const hasAnyExtension = lastSegment.includes(".");

    if (pathname.endsWith("/") || pathname.toLowerCase().endsWith(".html") || hasAnyExtension) {
      return uri;
    }

    parsed.pathname = `${pathname}.html`;
    return parsed.toString();
  } catch {
    return uri;
  }
};

const toListing = (row: AnyRecord): Listing => {
  const rentFrequencyRaw =
    typeof row.rent_frequency === "string" ? row.rent_frequency : undefined;
  const source = String(row.source ?? "aqar") as Listing["source"];
  const listingUri = normalizeListingUri(source, String(row.listing_uri ?? ""));

  return {
    id: String(row.id ?? ""),
    source,
    listing_uri: listingUri,
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

const createAbortError = (): Error => {
  if (typeof DOMException !== "undefined") {
    return new DOMException("Aborted", "AbortError");
  }

  const fallback = new Error("Aborted");
  fallback.name = "AbortError";
  return fallback;
};

const handleSupabaseError = (error: SupabaseErrorLike | null): never | void => {
  if (!error) {
    return;
  }

  if (isAbortLikeError(error)) {
    throw createAbortError();
  }

  throw new Error(error.message ?? "Supabase request failed");
};

const isMissingApiKeyError = (error: SupabaseErrorLike | null | undefined): boolean => {
  const message = error?.message ?? "";
  return message.includes("No API key found in request");
};

const applyAbortSignal = <TQuery extends { abortSignal?: (signal: AbortSignal) => TQuery }>(
  query: TQuery,
  signal?: AbortSignal
): TQuery => {
  if (!signal || !query || typeof query.abortSignal !== "function") {
    return query;
  }

  return query.abortSignal(signal);
};

const runSupabaseQuery = async <T>(
  queryFactory: (supabase: any) => Promise<SupabaseResult<T>>
): Promise<SupabaseResult<T>> => {
  const firstAttempt = await queryFactory(getSupabaseBrowserClient() as any);

  if (isMissingApiKeyError(firstAttempt.error)) {
    resetSupabaseBrowserClient();
    const retryAttempt = await queryFactory(getSupabaseBrowserClient() as any);
    handleSupabaseError(retryAttempt.error);
    return retryAttempt;
  }

  handleSupabaseError(firstAttempt.error);
  return firstAttempt;
};

const applySort = (query: any, sort: ListingSort): any => {
  switch (sort) {
    case "price_asc":
      return query.order("price", { ascending: true, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "price_desc":
      return query.order("price", { ascending: false, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "area_asc":
      return query.order("area_m2", { ascending: true, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "area_desc":
      return query.order("area_m2", { ascending: false, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "price_per_m2_asc":
      return query.order("price_per_m2", { ascending: true, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "price_per_m2_desc":
      return query.order("price_per_m2", { ascending: false, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "bedrooms_desc":
      return query.order("bedrooms", { ascending: false, nullsFirst: false }).order("id", {
        ascending: false
      });
    case "newest":
    default:
      return query.order("listed_at", { ascending: false, nullsFirst: false }).order("id", {
        ascending: false
      });
  }
};

const applyBoundsToQuery = (query: any, bounds: MapBounds): any => {
  let next = query
    .gte("latitude", bounds.south)
    .lte("latitude", bounds.north)
    .gte("longitude", bounds.west)
    .lte("longitude", bounds.east);

  return next;
};

const applyListingFiltersToQuery = (
  query: any,
  rawFilters: ListingFilters,
  includeNumeric: boolean,
  bounds?: MapBounds,
  forceBounds = false
): any => {
  const filters = normalizeFilters(rawFilters);
  let next = query.eq("goal", filters.goal).eq("listing_type", filters.listing_type);

  if (filters.rent_frequency.length > 0) {
    next = next.in("rent_frequency", filters.rent_frequency);
  }

  if (filters.property_type.length > 0) {
    next = next.in("property_type", filters.property_type);
  }

  if (filters.region.length > 0) {
    next = next.in("region_code", filters.region);
  }

  if (filters.city.length > 0) {
    next = next.in("city_code", filters.city);
  }

  if (filters.district.length > 0) {
    next = next.in("district_code", filters.district);
  }

  if (includeNumeric) {
    if (typeof filters.price_min === "number") {
      next = next.gte("price", filters.price_min);
    }

    if (typeof filters.price_max === "number") {
      next = next.lte("price", filters.price_max);
    }

    if (typeof filters.area_min === "number") {
      next = next.gte("area_m2", filters.area_min);
    }

    if (typeof filters.area_max === "number") {
      next = next.lte("area_m2", filters.area_max);
    }

    if (typeof filters.bedrooms_min === "number" && filters.bedrooms_min > 0) {
      next = next.gte("bedrooms", filters.bedrooms_min);
    }

    if (typeof filters.bathrooms_min === "number" && filters.bathrooms_min > 0) {
      next = next.gte("bathrooms", filters.bathrooms_min);
    }

    if (typeof filters.rooms_min === "number" && filters.rooms_min > 0) {
      next = next.gte("rooms", filters.rooms_min);
    }
  }

  const shouldApplyBounds = forceBounds || (filters.in_view && Boolean(bounds));

  if (shouldApplyBounds && bounds) {
    next = applyBoundsToQuery(next, bounds);
  }

  return next;
};

const loadFilteredSnapshotListings = async (
  filters: ListingFilters,
  includeNumeric: boolean,
  bounds: MapBounds | undefined,
  signal?: AbortSignal
): Promise<Listing[]> => {
  const normalized = normalizeFilters(filters);
  const rows: Listing[] = [];

  for (let offset = 0; ; offset += SNAPSHOT_BATCH_SIZE) {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const { data } = await runSupabaseQuery<AnyRecord[]>((supabase) => {
      let request = supabase.from("mv_snapshot_listings_latest").select(SNAPSHOT_SELECT_COLUMNS);
      request = applyListingFiltersToQuery(request, normalized, includeNumeric, bounds);
      request = applySort(request, "newest");
      request = request.range(offset, offset + SNAPSHOT_BATCH_SIZE - 1);
      request = applyAbortSignal(request, signal);
      return request;
    });

    const batch = toRecordArray(data).map(toListing);

    if (batch.length === 0) {
      break;
    }

    rows.push(...batch);

    if (batch.length < SNAPSHOT_BATCH_SIZE) {
      break;
    }
  }

  return rows;
};

const fetchFilteredSnapshotListings = async (
  filters: ListingFilters,
  includeNumeric: boolean,
  bounds: MapBounds | undefined,
  options: FetchOptions = {}
): Promise<Listing[]> => {
  const normalized = normalizeFilters(filters);
  const filterPayload = toFilterPayload(normalized, includeNumeric);
  const boundsPayload = toBoundsPayload(bounds);

  return runCachedQuery({
    key: buildCacheKey("mv_snapshot_listings_latest_rows", {
      filters: filterPayload,
      includeNumeric,
      bounds: boundsPayload
    }),
    ttlMs: options.ttlMs ?? MV_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => loadFilteredSnapshotListings(normalized, includeNumeric, bounds, signal)
  });
};

const mapRankingsToAreaStats = (
  rankings: GeoRankingRow[],
  level: MapLevel
): MapAreaStat[] => {
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
};

export async function fetchFilterOptions(options: FetchOptions = {}): Promise<FilterOptionSet> {
  return runCachedQuery({
    key: buildCacheKey("mv_filter_options"),
    ttlMs: options.ttlMs ?? MV_TTL_MS,
    signal: options.signal,
    fetcher: async (signal) => {
      const { data } = await runSupabaseQuery<AnyRecord | null>((supabase) => {
        let request = supabase
          .from("mv_filter_options")
          .select("goal,rent_frequency,property_type,listing_type,region,city,district")
          .limit(1)
          .maybeSingle();
        request = applyAbortSignal(request, signal);
        return request;
      });

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
      const runPage = async (page: number): Promise<{ rows: Listing[]; totalItems: number }> => {
        const from = (page - 1) * LISTINGS_BROWSE_PAGE_LIMIT;
        const to = from + LISTINGS_BROWSE_PAGE_LIMIT - 1;

        const { data, count } = await runSupabaseQuery<AnyRecord[]>((supabase) => {
          let request = supabase
            .from("listings")
            .select(LISTING_SELECT_COLUMNS, { count: "exact" })
            .eq("is_active", true);

          request = applyListingFiltersToQuery(request, normalized, true);
          request = applySort(request, normalized.sort);
          request = request.range(from, to);
          request = applyAbortSignal(request, signal);
          return request;
        });

        return {
          rows: toRecordArray(data).map(toListing),
          totalItems: Math.max(0, count ?? 0)
        };
      };

      const initial = await runPage(requestedPage);
      const totalPages = Math.max(1, Math.ceil(initial.totalItems / LISTINGS_BROWSE_PAGE_LIMIT));
      const safePage = Math.min(requestedPage, totalPages);

      if (safePage !== requestedPage) {
        const fallback = await runPage(safePage);
        return {
          rows: fallback.rows,
          totalItems: fallback.totalItems,
          page: safePage,
          pageSize: LISTINGS_BROWSE_PAGE_LIMIT,
          totalPages
        };
      }

      return {
        rows: initial.rows,
        totalItems: initial.totalItems,
        page: safePage,
        pageSize: LISTINGS_BROWSE_PAGE_LIMIT,
        totalPages
      };
    }
  });
}

export async function fetchKpiLive(
  filters: ListingFilters,
  bounds?: MapBounds,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  const rows = await fetchFilteredSnapshotListings(filters, true, bounds, options);
  return buildAnalyticsSnapshot(rows);
}

export async function fetchKpiDaily(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<AnalyticsSnapshot> {
  const analyticsFilters = stripNumericFilterValues(filters);
  const rows = await fetchFilteredSnapshotListings(analyticsFilters, false, undefined, options);
  return buildAnalyticsSnapshot(rows);
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
  const rows = await fetchFilteredSnapshotListings(analyticsFilters, false, undefined, options);

  return {
    snapshot: buildAnalyticsSnapshot(rows),
    rankings: {
      region: buildGeoRankingRows(rows, "region"),
      city: buildGeoRankingRows(rows, "city"),
      district: buildGeoRankingRows(rows, "district")
    }
  };
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
      const { data, count } = await runSupabaseQuery<AnyRecord[]>((supabase) => {
        let request = supabase
          .from("listings")
          .select(LISTING_SELECT_COLUMNS, { count: "exact" })
          .eq("is_active", true);

        request = applyListingFiltersToQuery(request, normalized, true, bounds, true);
        request = applySort(request, "newest");
        request = request.range(0, cappedLimit - 1);
        request = applyAbortSignal(request, signal);
        return request;
      });

      const rows = toRecordArray(data).map(toListing);
      const totalInBounds = Math.max(0, count ?? 0);

      return {
        rows,
        returnedCount: rows.length,
        totalInBounds
      };
    }
  });
}

export async function fetchMapAreaStatsDailyBundle(
  filters: ListingFilters,
  options: FetchOptions = {}
): Promise<MapAreaStatsBundle> {
  const analyticsFilters = stripNumericFilterValues(filters);
  const rows = await fetchFilteredSnapshotListings(analyticsFilters, false, undefined, options);

  const regionRankings = buildGeoRankingRows(rows, "region");
  const cityRankings = buildGeoRankingRows(rows, "city");
  const districtRankings = buildGeoRankingRows(rows, "district");

  return {
    region: mapRankingsToAreaStats(regionRankings, "region"),
    city: mapRankingsToAreaStats(cityRankings, "city"),
    district: mapRankingsToAreaStats(districtRankings, "district")
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
