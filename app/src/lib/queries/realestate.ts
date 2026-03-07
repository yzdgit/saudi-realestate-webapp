import { getSupabaseBrowserClient } from "@/lib/supabase";
import type {
  AnalyticsSnapshot,
  FilterOptionSet,
  GeoRankingLevel,
  GeoRankingRow,
  Listing,
  ListingFilters,
  MapAreaStat,
  MapBounds
} from "@/lib/realestate/types";

type AnyRecord = Record<string, unknown>;

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
  pageSize: 12,
  totalPages: 1
};

export const EMPTY_MAP_POINTS_RESULT: MapPointsResult = {
  rows: [],
  returnedCount: 0,
  totalInBounds: 0
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

const toFilterPayload = (filters: ListingFilters): AnyRecord => {
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
    price_per_m2: toNullableNumber(row.price_per_m2)
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

const handleRpcError = (error: { message?: string } | null): never | void => {
  if (!error) {
    return;
  }

  throw new Error(error.message ?? "Supabase RPC request failed");
};

export async function fetchFilterOptions(): Promise<FilterOptionSet> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_filter_options");
  handleRpcError(error);

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

export async function fetchListingsBrowse(
  filters: ListingFilters,
  pageSize: number
): Promise<ListingsBrowseResult> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_listings_browse", {
    p_filters: toFilterPayload(filters),
    p_sort: filters.sort,
    p_page: filters.page,
    p_page_size: pageSize
  });
  handleRpcError(error);

  const payload = toRecord(data);
  const rows = toRecordArray(payload.rows).map(toListing);

  return {
    rows,
    totalItems: toNumber(payload.total_items),
    page: Math.max(1, toNumber(payload.page, 1)),
    pageSize: Math.max(1, toNumber(payload.page_size, pageSize)),
    totalPages: Math.max(1, toNumber(payload.total_pages, 1))
  };
}

export async function fetchListingsStats(
  filters: ListingFilters,
  bounds?: MapBounds
): Promise<AnalyticsSnapshot> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_listings_stats", {
    p_filters: toFilterPayload(filters),
    p_bounds: toBoundsPayload(bounds)
  });
  handleRpcError(error);

  return toSnapshot(data);
}

export async function fetchGeoRankings(
  filters: ListingFilters,
  level: GeoRankingLevel
): Promise<GeoRankingRow[]> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_geo_rankings", {
    p_filters: toFilterPayload(filters),
    p_level: level
  });
  handleRpcError(error);

  return toRecordArray(data).map((item) => ({
    code: String(item.code ?? ""),
    level: String(item.level ?? level) as GeoRankingLevel,
    count: toNumber(item.count),
    meanPrice: toNumber(item.meanPrice),
    medianPrice: toNumber(item.medianPrice),
    meanPricePerM2: toNumber(item.meanPricePerM2),
    medianPricePerM2: toNumber(item.medianPricePerM2),
    rentShare: toNumber(item.rentShare),
    saleShare: toNumber(item.saleShare)
  }));
}

export async function fetchMapPoints(
  filters: ListingFilters,
  bounds: MapBounds | undefined,
  limit = 500
): Promise<MapPointsResult> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_map_points", {
    p_filters: toFilterPayload(filters),
    p_bounds: toBoundsPayload(bounds),
    p_limit: limit
  });
  handleRpcError(error);

  const payload = toRecord(data);

  return {
    rows: toRecordArray(payload.rows).map(toListing),
    returnedCount: toNumber(payload.returned_count),
    totalInBounds: toNumber(payload.total_in_bounds)
  };
}

export async function fetchMapAreaStats(
  filters: ListingFilters,
  level: GeoRankingLevel,
  regionCode?: string,
  cityCode?: string
): Promise<MapAreaStat[]> {
  const supabase = getSupabaseBrowserClient() as any;
  const { data, error } = await supabase.rpc("rpc_map_area_stats", {
    p_filters: toFilterPayload(filters),
    p_level: level,
    p_region_code: regionCode ?? null,
    p_city_code: cityCode ?? null
  });
  handleRpcError(error);

  return toRecordArray(data).map((item) => ({
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
}

export async function fetchLatestListings(limit = 50): Promise<Listing[]> {
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
