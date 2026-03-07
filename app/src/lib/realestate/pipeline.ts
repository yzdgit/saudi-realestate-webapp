import type { ParsedUrlQuery } from "querystring";
import type {
  AnalyticsSnapshot,
  GeoRankingLevel,
  GeoRankingRow,
  HistogramDatum,
  Listing,
  ListingFilters,
  ListingGoal,
  ListingSort,
  ListingType,
  MapBounds,
  PaginationResult,
  PropertyType,
  RentFrequency
} from "@/lib/realestate/types";

const goalValues = ["sale", "rent"] as const;
const rentFrequencyValues = ["monthly", "quarterly", "semi", "annually"] as const;
const listingTypeValues = ["residential", "commercial"] as const;
const sortValues = [
  "newest",
  "price_asc",
  "price_desc",
  "area_asc",
  "area_desc",
  "price_per_m2_asc",
  "price_per_m2_desc",
  "bedrooms_desc"
] as const;

export const DEFAULT_PAGE_SIZE = 12;

export const defaultFilters: ListingFilters = {
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

export function normalizeFilters(filters: ListingFilters): ListingFilters {
  return {
    ...filters,
    rent_frequency: [],
    district: filters.city.length > 0 ? filters.district : []
  };
}

const toQueryList = (value: string | string[] | undefined): string[] => {
  if (!value) {
    return [];
  }

  const rawValues = Array.isArray(value) ? value : [value];

  return rawValues
    .flatMap((item) => item.split(","))
    .map((item) => item.trim())
    .filter(Boolean);
};

const toNumber = (value: string | string[] | undefined): number | undefined => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return undefined;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) ? parsed : undefined;
};

const toInteger = (value: string | string[] | undefined): number | undefined => {
  const parsed = toNumber(value);

  if (typeof parsed !== "number") {
    return undefined;
  }

  return Math.trunc(parsed);
};

const parseEnum = <T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T,
  fallback: T[number]
): T[number] => {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return fallback;
  }

  return (allowed.includes(raw as T[number]) ? raw : fallback) as T[number];
};

const parseEnumList = <T extends readonly string[]>(
  value: string | string[] | undefined,
  allowed: T
): T[number][] => {
  const list = toQueryList(value).filter((entry) => allowed.includes(entry as T[number]));

  return Array.from(new Set(list)) as T[number][];
};

export function parseFiltersFromQuery(query: ParsedUrlQuery): ListingFilters {
  const page = toInteger(query.page);
  const goal = parseEnum(query.goal, goalValues, defaultFilters.goal);
  const city = Array.from(new Set(toQueryList(query.city)));
  const district =
    city.length > 0 ? Array.from(new Set(toQueryList(query.district))) : [];
  const rentFrequency: RentFrequency[] = [];

  return normalizeFilters({
    goal,
    rent_frequency: rentFrequency,
    property_type: Array.from(new Set(toQueryList(query.property_type))) as PropertyType[],
    listing_type: parseEnum(query.listing_type, listingTypeValues, defaultFilters.listing_type) as ListingType,
    region: Array.from(new Set(toQueryList(query.region))),
    city,
    district,
    price_min: toNumber(query.price_min),
    price_max: toNumber(query.price_max),
    area_min: toNumber(query.area_min),
    area_max: toNumber(query.area_max),
    bedrooms_min: toNumber(query.bedrooms_min),
    bathrooms_min: toNumber(query.bathrooms_min),
    rooms_min: toNumber(query.rooms_min),
    sort: parseEnum(query.sort, sortValues, "newest") as ListingSort,
    page: page && page > 0 ? page : 1,
    in_view: query.in_view === "1"
  });
}

export function serializeFiltersToQuery(filters: ListingFilters): Record<string, string> {
  const normalized = normalizeFilters(filters);
  const query: Record<string, string> = {};

  if (normalized.goal !== defaultFilters.goal) {
    query.goal = normalized.goal;
  }

  if (normalized.property_type.length > 0) {
    query.property_type = normalized.property_type.join(",");
  }

  if (normalized.listing_type !== defaultFilters.listing_type) {
    query.listing_type = normalized.listing_type;
  }

  if (normalized.region.length > 0) {
    query.region = normalized.region.join(",");
  }

  if (normalized.city.length > 0) {
    query.city = normalized.city.join(",");
  }

  if (normalized.district.length > 0) {
    query.district = normalized.district.join(",");
  }

  if (typeof normalized.price_min === "number") {
    query.price_min = String(normalized.price_min);
  }

  if (typeof normalized.price_max === "number") {
    query.price_max = String(normalized.price_max);
  }

  if (typeof normalized.area_min === "number") {
    query.area_min = String(normalized.area_min);
  }

  if (typeof normalized.area_max === "number") {
    query.area_max = String(normalized.area_max);
  }

  if (typeof normalized.bedrooms_min === "number") {
    query.bedrooms_min = String(normalized.bedrooms_min);
  }

  if (typeof normalized.bathrooms_min === "number") {
    query.bathrooms_min = String(normalized.bathrooms_min);
  }

  if (typeof normalized.rooms_min === "number") {
    query.rooms_min = String(normalized.rooms_min);
  }

  if (normalized.sort !== "newest") {
    query.sort = normalized.sort;
  }

  if (normalized.page > 1) {
    query.page = String(normalized.page);
  }

  if (normalized.in_view) {
    query.in_view = "1";
  }

  return query;
}

export function applyListingFilters(
  listings: Listing[],
  filters: ListingFilters,
  bounds?: MapBounds
): Listing[] {
  return listings.filter((item) => {
    if (item.goal !== filters.goal) {
      return false;
    }

    if (filters.property_type.length > 0 && !filters.property_type.includes(item.property_type)) {
      return false;
    }

    if (item.listing_type !== filters.listing_type) {
      return false;
    }

    if (filters.region.length > 0 && !filters.region.includes(item.region_code)) {
      return false;
    }

    if (filters.city.length > 0 && !filters.city.includes(item.city_code)) {
      return false;
    }

    if (filters.district.length > 0 && !filters.district.includes(item.district_code)) {
      return false;
    }

    if (typeof filters.price_min === "number" && item.price < filters.price_min) {
      return false;
    }

    if (typeof filters.price_max === "number" && item.price > filters.price_max) {
      return false;
    }

    if (typeof filters.area_min === "number" && item.area < filters.area_min) {
      return false;
    }

    if (typeof filters.area_max === "number" && item.area > filters.area_max) {
      return false;
    }

    if (typeof filters.bedrooms_min === "number" && (item.bedrooms ?? 0) < filters.bedrooms_min) {
      return false;
    }

    if (typeof filters.bathrooms_min === "number" && (item.bathrooms ?? 0) < filters.bathrooms_min) {
      return false;
    }

    if (typeof filters.rooms_min === "number" && (item.rooms ?? 0) < filters.rooms_min) {
      return false;
    }

    if (filters.in_view && bounds && !isInBounds(item.latitude, item.longitude, bounds)) {
      return false;
    }

    return true;
  });
}

export function applySorting(listings: Listing[], sort: ListingSort): Listing[] {
  if (sort === "newest") {
    return [...listings];
  }

  const sorted = [...listings];

  sorted.sort((left, right) => {
    switch (sort) {
      case "price_asc":
        return left.price - right.price;
      case "price_desc":
        return right.price - left.price;
      case "area_asc":
        return left.area - right.area;
      case "area_desc":
        return right.area - left.area;
      case "price_per_m2_asc":
        return (left.price_per_m2 ?? 0) - (right.price_per_m2 ?? 0);
      case "price_per_m2_desc":
        return (right.price_per_m2 ?? 0) - (left.price_per_m2 ?? 0);
      case "bedrooms_desc":
        return (right.bedrooms ?? 0) - (left.bedrooms ?? 0);
      default:
        return 0;
    }
  });

  return sorted;
}

export function paginateListings<T>(items: T[], page: number, pageSize: number): PaginationResult<T> {
  const safePageSize = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * safePageSize;
  const end = start + safePageSize;

  return {
    items: items.slice(start, end),
    page: safePage,
    totalPages,
    pageSize: safePageSize,
    totalItems
  };
}

export function isInBounds(latitude: number, longitude: number, bounds: MapBounds): boolean {
  return (
    latitude >= bounds.south &&
    latitude <= bounds.north &&
    longitude >= bounds.west &&
    longitude <= bounds.east
  );
}

const countBy = <T>(items: T[], keyFn: (item: T) => string): Record<string, number> => {
  const counts: Record<string, number> = {};

  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return counts;
};

const median = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
};

const mean = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const min = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return Math.min(...values);
};

const max = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return Math.max(...values);
};

const histogram = (values: number[], bins: number): HistogramDatum[] => {
  if (values.length === 0) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);

  if (min === max) {
    return [{ range: `${Math.round(min)}`, count: values.length }];
  }

  const binSize = (max - min) / bins;
  const entries = Array.from({ length: bins }, (_, index) => ({
    start: min + index * binSize,
    end: min + (index + 1) * binSize,
    count: 0
  }));

  for (const value of values) {
    const rawIndex = Math.floor((value - min) / binSize);
    const safeIndex = rawIndex >= bins ? bins - 1 : rawIndex;
    entries[safeIndex].count += 1;
  }

  return entries.map((entry) => ({
    range: `${Math.round(entry.start)}-${Math.round(entry.end)}`,
    count: entry.count
  }));
};

export function buildAnalyticsSnapshot(listings: Listing[]): AnalyticsSnapshot {
  const totalListings = listings.length;
  const prices = listings
    .map((item) => item.price)
    .filter((value) => Number.isFinite(value) && value > 0);
  const areas = listings
    .map((item) => item.area)
    .filter((value) => Number.isFinite(value) && value > 0);
  const pricesPerM2 = listings
    .map((item) => item.price_per_m2)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const saleCount = listings.filter((item) => item.goal === "sale").length;
  const rentCount = listings.filter((item) => item.goal === "rent").length;

  const cityCounts = countBy(listings, (item) => item.city_code);

  const propertyMix: Record<string, { sale: number; rent: number }> = {};

  for (const item of listings) {
    const bucket = propertyMix[item.property_type] ?? { sale: 0, rent: 0 };
    bucket[item.goal] += 1;
    propertyMix[item.property_type] = bucket;
  }

  const districtAgg: Record<string, { total: number; count: number }> = {};

  for (const item of listings) {
    if (typeof item.price_per_m2 !== "number" || item.price_per_m2 <= 0) {
      continue;
    }

    const bucket = districtAgg[item.district_code] ?? { total: 0, count: 0 };
    bucket.total += item.price_per_m2;
    bucket.count += 1;
    districtAgg[item.district_code] = bucket;
  }

  const cityGeoAgg: Record<
    string,
    {
      count: number;
      latTotal: number;
      lngTotal: number;
      pricePerM2Total: number;
      pricePerM2Count: number;
    }
  > = {};

  for (const item of listings) {
    const bucket = cityGeoAgg[item.city_code] ?? {
      count: 0,
      latTotal: 0,
      lngTotal: 0,
      pricePerM2Total: 0,
      pricePerM2Count: 0
    };

    bucket.count += 1;
    bucket.latTotal += item.latitude;
    bucket.lngTotal += item.longitude;

    if (typeof item.price_per_m2 === "number" && item.price_per_m2 > 0) {
      bucket.pricePerM2Total += item.price_per_m2;
      bucket.pricePerM2Count += 1;
    }

    cityGeoAgg[item.city_code] = bucket;
  }

  return {
    totalListings,
    medianPrice: median(prices),
    meanPrice: mean(prices),
    minPrice: min(prices),
    maxPrice: max(prices),
    medianPricePerM2: median(pricesPerM2),
    meanPricePerM2: mean(pricesPerM2),
    minPricePerM2: min(pricesPerM2),
    maxPricePerM2: max(pricesPerM2),
    medianArea: median(areas),
    meanArea: mean(areas),
    minArea: min(areas),
    maxArea: max(areas),
    rentShare: totalListings > 0 ? rentCount / totalListings : 0,
    saleShare: totalListings > 0 ? saleCount / totalListings : 0,
    goalDistribution: [
      { key: "sale", label: "sale", value: saleCount },
      { key: "rent", label: "rent", value: rentCount }
    ],
    propertyTypeByGoal: Object.entries(propertyMix)
      .map(([propertyType, bucket]) => ({ propertyType, sale: bucket.sale, rent: bucket.rent }))
      .sort((left, right) => right.sale + right.rent - (left.sale + left.rent)),
    cityDistribution: Object.entries(cityCounts)
      .map(([key, value]) => ({ key, label: key, value }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 12),
    districtAvgPricePerM2: Object.entries(districtAgg)
      .map(([districtCode, bucket]) => ({ districtCode, value: bucket.total / bucket.count }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 12),
    priceHistogram: histogram(prices, 8),
    areaHistogram: histogram(areas, 8),
    scatter: listings
      .filter((item) => item.price > 0 && item.area > 0)
      .map((item) => ({
        id: item.id,
        source: item.source,
        area: item.area,
        price: item.price,
        price_per_m2: item.price_per_m2
      })),
    cityGeo: Object.entries(cityGeoAgg)
      .map(([cityCode, bucket]) => ({
        cityCode,
        count: bucket.count,
        avgPricePerM2:
          bucket.pricePerM2Count > 0 ? bucket.pricePerM2Total / bucket.pricePerM2Count : 0,
        latitude: bucket.latTotal / bucket.count,
        longitude: bucket.lngTotal / bucket.count
      }))
      .sort((left, right) => right.count - left.count)
  };
}

type GeoBucket = {
  count: number;
  prices: number[];
  pricesPerM2: number[];
  rentCount: number;
  saleCount: number;
};

const groupingCodeByLevel = (listing: Listing, level: GeoRankingLevel): string => {
  if (level === "region") {
    return listing.region_code;
  }

  if (level === "city") {
    return listing.city_code;
  }

  return listing.district_code;
};

export function buildGeoRankingRows(listings: Listing[], level: GeoRankingLevel): GeoRankingRow[] {
  const buckets = new Map<string, GeoBucket>();

  for (const listing of listings) {
    const code = groupingCodeByLevel(listing, level);
    const bucket = buckets.get(code) ?? {
      count: 0,
      prices: [],
      pricesPerM2: [],
      rentCount: 0,
      saleCount: 0
    };

    bucket.count += 1;
    if (listing.price > 0) {
      bucket.prices.push(listing.price);
    }

    if (typeof listing.price_per_m2 === "number" && Number.isFinite(listing.price_per_m2) && listing.price_per_m2 > 0) {
      bucket.pricesPerM2.push(listing.price_per_m2);
    }

    if (listing.goal === "rent") {
      bucket.rentCount += 1;
    } else {
      bucket.saleCount += 1;
    }

    buckets.set(code, bucket);
  }

  return Array.from(buckets.entries())
    .map(([code, bucket]) => ({
      code,
      level,
      count: bucket.count,
      meanPrice: mean(bucket.prices),
      medianPrice: median(bucket.prices),
      meanPricePerM2: mean(bucket.pricesPerM2),
      medianPricePerM2: median(bucket.pricesPerM2),
      rentShare: bucket.count > 0 ? bucket.rentCount / bucket.count : 0,
      saleShare: bucket.count > 0 ? bucket.saleCount / bucket.count : 0
    }))
    .sort((left, right) => right.count - left.count);
}

export function getGeoDrillLevel(filters: Pick<ListingFilters, "region" | "city">): GeoRankingLevel {
  if (filters.city.length > 0) {
    return "district";
  }

  if (filters.region.length > 0) {
    return "city";
  }

  return "region";
}

export function toggleValue<T extends string>(items: T[], value: T): T[] {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }

  return [...items, value];
}

export function hasActiveFilters(filters: ListingFilters): boolean {
  const normalized = normalizeFilters(filters);

  return (
    normalized.goal !== defaultFilters.goal ||
    normalized.rent_frequency.length > 0 ||
    normalized.property_type.length > 0 ||
    normalized.listing_type !== defaultFilters.listing_type ||
    normalized.region.length > 0 ||
    normalized.city.length > 0 ||
    normalized.district.length > 0 ||
    typeof normalized.price_min === "number" ||
    typeof normalized.price_max === "number" ||
    typeof normalized.area_min === "number" ||
    typeof normalized.area_max === "number" ||
    typeof normalized.bedrooms_min === "number" ||
    typeof normalized.bathrooms_min === "number" ||
    typeof normalized.rooms_min === "number" ||
    normalized.sort !== defaultFilters.sort ||
    normalized.in_view
  );
}

export function withResetPage(filters: ListingFilters): ListingFilters {
  return normalizeFilters({
    ...filters,
    page: 1
  });
}

export function goalLabel(goal: ListingGoal): string {
  return goal;
}
