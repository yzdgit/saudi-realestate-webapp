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

export const DEFAULT_PAGE_SIZE = 10;

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
    // Dataset is pre-sorted by listed_at desc at load time (see dataset.ts).
    // Array.filter preserves order, so the filtered list is already newest-first.
    return listings;
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

  let result = values[0];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] < result) {
      result = values[i];
    }
  }
  return result;
};

const max = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  let result = values[0];
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > result) {
      result = values[i];
    }
  }
  return result;
};

const OUTLIER_MIN_PRICE = 5000;
const OUTLIER_MIN_AREA_M2 = 20;
const OUTLIER_MAX_AREA_M2 = 50000;
const OUTLIER_MIN_PRICE_PER_M2 = 400;
const OUTLIER_MAX_PRICE_PER_M2 = 200000;
const OUTLIER_PERCENTILE_LOW = 0.01;
const OUTLIER_PERCENTILE_HIGH = 0.99;
const OUTLIER_MAD_Z_THRESHOLD = 3.5;
const ROBUST_Z_SCALE = 0.6745;

type OutlierAssessment = {
  isOutlier: boolean;
  isHardInvalid: boolean;
  isMadOutlier: boolean;
  isPercentileOutlier: boolean;
  priceClean: number | null;
  areaClean: number | null;
  pricePerM2Clean: number | null;
};

type OutlierProfile = {
  byId: Map<string, OutlierAssessment>;
};

type GoalOutlierStats = {
  priceP01?: number;
  priceP99?: number;
  areaP01?: number;
  areaP99?: number;
  ppm2P01?: number;
  ppm2P99?: number;
  priceMedian?: number;
  areaMedian?: number;
  ppm2Median?: number;
  priceMad?: number;
  areaMad?: number;
  ppm2Mad?: number;
};

const isHardValidListing = (listing: Listing): boolean => {
  const ppm2 = listing.price_per_m2;

  return (
    listing.price > OUTLIER_MIN_PRICE &&
    listing.area >= OUTLIER_MIN_AREA_M2 &&
    listing.area <= OUTLIER_MAX_AREA_M2 &&
    typeof ppm2 === "number" &&
    Number.isFinite(ppm2) &&
    ppm2 >= OUTLIER_MIN_PRICE_PER_M2 &&
    ppm2 <= OUTLIER_MAX_PRICE_PER_M2
  );
};

const quantile = (values: number[], percentile: number): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex];
  }

  const weight = index - lowerIndex;
  return sorted[lowerIndex] * (1 - weight) + sorted[upperIndex] * weight;
};

const clampWithBounds = (
  value: number,
  minBound: number | undefined,
  maxBound: number | undefined
): number => {
  let next = value;

  if (typeof minBound === "number") {
    next = Math.max(next, minBound);
  }

  if (typeof maxBound === "number") {
    next = Math.min(next, maxBound);
  }

  return next;
};

const medianAbsoluteDeviation = (values: number[], medianValue: number): number | undefined => {
  if (values.length === 0) {
    return undefined;
  }

  const absoluteDeviations = values.map((value) => Math.abs(value - medianValue));
  const deviationMedian = median(absoluteDeviations);

  return Number.isFinite(deviationMedian) ? deviationMedian : undefined;
};

const isMadOutlierValue = (
  value: number,
  medianValue: number | undefined,
  madValue: number | undefined
): boolean => {
  if (
    typeof medianValue !== "number" ||
    typeof madValue !== "number" ||
    !Number.isFinite(medianValue) ||
    !Number.isFinite(madValue) ||
    madValue <= 0
  ) {
    return false;
  }

  const robustZ = Math.abs((ROBUST_Z_SCALE * (value - medianValue)) / madValue);
  return Number.isFinite(robustZ) && robustZ > OUTLIER_MAD_Z_THRESHOLD;
};

const buildGoalOutlierStats = (goalListings: Listing[]): GoalOutlierStats => {
  const priceValues = goalListings.map((item) => item.price);
  const areaValues = goalListings.map((item) => item.area);
  const ppm2Values = goalListings
    .map((item) => item.price_per_m2)
    .filter((value): value is number => typeof value === "number");

  const priceMedian = quantile(priceValues, 0.5);
  const areaMedian = quantile(areaValues, 0.5);
  const ppm2Median = quantile(ppm2Values, 0.5);

  return {
    priceP01: quantile(priceValues, OUTLIER_PERCENTILE_LOW),
    priceP99: quantile(priceValues, OUTLIER_PERCENTILE_HIGH),
    areaP01: quantile(areaValues, OUTLIER_PERCENTILE_LOW),
    areaP99: quantile(areaValues, OUTLIER_PERCENTILE_HIGH),
    ppm2P01: quantile(ppm2Values, OUTLIER_PERCENTILE_LOW),
    ppm2P99: quantile(ppm2Values, OUTLIER_PERCENTILE_HIGH),
    priceMedian,
    areaMedian,
    ppm2Median,
    priceMad: typeof priceMedian === "number" ? medianAbsoluteDeviation(priceValues, priceMedian) : undefined,
    areaMad: typeof areaMedian === "number" ? medianAbsoluteDeviation(areaValues, areaMedian) : undefined,
    ppm2Mad: typeof ppm2Median === "number" ? medianAbsoluteDeviation(ppm2Values, ppm2Median) : undefined
  };
};

const buildOutlierProfile = (listings: Listing[]): OutlierProfile => {
  const hardValidByGoal: Record<ListingGoal, Listing[]> = {
    sale: [],
    rent: []
  };

  for (const listing of listings) {
    if (!isHardValidListing(listing)) {
      continue;
    }

    hardValidByGoal[listing.goal].push(listing);
  }

  const goalStats: Record<ListingGoal, GoalOutlierStats> = {
    sale: buildGoalOutlierStats(hardValidByGoal.sale),
    rent: buildGoalOutlierStats(hardValidByGoal.rent)
  };

  const byId = new Map<string, OutlierAssessment>();

  for (const listing of listings) {
    const isHardInvalid = !isHardValidListing(listing);
    const ppm2 = typeof listing.price_per_m2 === "number" ? listing.price_per_m2 : 0;
    const stats = goalStats[listing.goal];

    const pricePercentileOutlier =
      !isHardInvalid &&
      typeof stats.priceP01 === "number" &&
      typeof stats.priceP99 === "number" &&
      (listing.price < stats.priceP01 || listing.price > stats.priceP99);

    const areaPercentileOutlier =
      !isHardInvalid &&
      typeof stats.areaP01 === "number" &&
      typeof stats.areaP99 === "number" &&
      (listing.area < stats.areaP01 || listing.area > stats.areaP99);

    const ppm2PercentileOutlier =
      !isHardInvalid &&
      typeof stats.ppm2P01 === "number" &&
      typeof stats.ppm2P99 === "number" &&
      (ppm2 < stats.ppm2P01 || ppm2 > stats.ppm2P99);

    const madOutlier =
      !isHardInvalid &&
      (
        isMadOutlierValue(listing.price, stats.priceMedian, stats.priceMad) ||
        isMadOutlierValue(listing.area, stats.areaMedian, stats.areaMad) ||
        isMadOutlierValue(ppm2, stats.ppm2Median, stats.ppm2Mad)
      );

    const isPercentileOutlier = pricePercentileOutlier || areaPercentileOutlier || ppm2PercentileOutlier;
    const isOutlier = isHardInvalid || isPercentileOutlier || madOutlier;

    byId.set(listing.id, {
      isOutlier,
      isHardInvalid,
      isMadOutlier: madOutlier,
      isPercentileOutlier,
      priceClean: isHardInvalid ? null : clampWithBounds(listing.price, stats.priceP01, stats.priceP99),
      areaClean: isHardInvalid ? null : clampWithBounds(listing.area, stats.areaP01, stats.areaP99),
      pricePerM2Clean: isHardInvalid ? null : clampWithBounds(ppm2, stats.ppm2P01, stats.ppm2P99)
    });
  }

  return { byId };
};

const SCATTER_SAMPLE_CAP = 500;

function sampleScatter(
  listings: Listing[],
  profile: OutlierProfile,
  cap: number
): AnalyticsSnapshot["scatter"] {
  const result: AnalyticsSnapshot["scatter"] = [];
  if (listings.length === 0) {
    return result;
  }

  const stride = Math.max(1, Math.floor(listings.length / cap));

  for (let i = 0; i < listings.length && result.length < cap; i += stride) {
    const item = listings[i];
    const assessment = profile.byId.get(item.id);
    const area = assessment?.areaClean;
    const price = assessment?.priceClean;
    const pricePerM2 = assessment?.pricePerM2Clean;

    if (
      typeof area !== "number" ||
      typeof price !== "number" ||
      !Number.isFinite(area) ||
      !Number.isFinite(price) ||
      area <= 0 ||
      price <= 0
    ) {
      continue;
    }

    result.push({
      id: item.id,
      source: item.source,
      area,
      price,
      price_per_m2: typeof pricePerM2 === "number" ? pricePerM2 : null
    });
  }

  return result;
}

const histogram = (values: number[], bins: number): HistogramDatum[] => {
  if (values.length === 0) {
    return [];
  }

  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i += 1) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }

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
  const outlierProfile = buildOutlierProfile(listings);
  const cleanListings = listings.filter((item) => !outlierProfile.byId.get(item.id)?.isOutlier);
  const totalListings = listings.length;
  const prices = cleanListings
    .map((item) => outlierProfile.byId.get(item.id)?.priceClean)
    .filter((value): value is number => typeof value === "number")
    .filter((value) => Number.isFinite(value) && value > 0);
  const areas = cleanListings
    .map((item) => outlierProfile.byId.get(item.id)?.areaClean)
    .filter((value): value is number => typeof value === "number")
    .filter((value) => Number.isFinite(value) && value > 0);
  const pricesPerM2 = cleanListings
    .map((item) => outlierProfile.byId.get(item.id)?.pricePerM2Clean)
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0);

  const saleCount = cleanListings.filter((item) => item.goal === "sale").length;
  const rentCount = cleanListings.filter((item) => item.goal === "rent").length;

  const cityCounts = countBy(cleanListings, (item) => item.city_code);

  const propertyMix: Record<string, { sale: number; rent: number }> = {};

  for (const item of cleanListings) {
    const bucket = propertyMix[item.property_type] ?? { sale: 0, rent: 0 };
    bucket[item.goal] += 1;
    propertyMix[item.property_type] = bucket;
  }

  const districtAgg: Record<string, { total: number; count: number }> = {};

  for (const item of cleanListings) {
    const pricePerM2 = outlierProfile.byId.get(item.id)?.pricePerM2Clean;
    if (typeof pricePerM2 !== "number" || pricePerM2 <= 0) {
      continue;
    }

    const bucket = districtAgg[item.district_code] ?? { total: 0, count: 0 };
    bucket.total += pricePerM2;
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

  for (const item of cleanListings) {
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

    const pricePerM2 = outlierProfile.byId.get(item.id)?.pricePerM2Clean;
    if (typeof pricePerM2 === "number" && pricePerM2 > 0) {
      bucket.pricePerM2Total += pricePerM2;
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
    scatter: sampleScatter(cleanListings, outlierProfile, SCATTER_SAMPLE_CAP),
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
  cleanCount: number;
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

// Fast aggregate-only snapshot for pages that show the stats row but no charts.
// Skips outlier processing, histograms, scatter, distributions, and rankings.
// Returns the same AnalyticsSnapshot shape with chart fields left empty.
export function buildBasicStats(listings: Listing[]): AnalyticsSnapshot {
  const totalListings = listings.length;

  if (totalListings === 0) {
    return {
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
  }

  const prices: number[] = [];
  const pricesPerM2: number[] = [];
  const areas: number[] = [];
  let saleCount = 0;
  let rentCount = 0;

  for (const item of listings) {
    if (Number.isFinite(item.price) && item.price > 0) {
      prices.push(item.price);
    }
    if (Number.isFinite(item.area) && item.area > 0) {
      areas.push(item.area);
    }
    if (typeof item.price_per_m2 === "number" && Number.isFinite(item.price_per_m2) && item.price_per_m2 > 0) {
      pricesPerM2.push(item.price_per_m2);
    }
    if (item.goal === "sale") {
      saleCount += 1;
    } else if (item.goal === "rent") {
      rentCount += 1;
    }
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
    propertyTypeByGoal: [],
    cityDistribution: [],
    districtAvgPricePerM2: [],
    priceHistogram: [],
    areaHistogram: [],
    scatter: [],
    cityGeo: []
  };
}

export function buildGeoRankingRows(listings: Listing[], level: GeoRankingLevel): GeoRankingRow[] {
  const outlierProfile = buildOutlierProfile(listings);
  const buckets = new Map<string, GeoBucket>();

  for (const listing of listings) {
    const code = groupingCodeByLevel(listing, level);
    const bucket = buckets.get(code) ?? {
      count: 0,
      cleanCount: 0,
      prices: [],
      pricesPerM2: [],
      rentCount: 0,
      saleCount: 0
    };

    bucket.count += 1;
    const assessment = outlierProfile.byId.get(listing.id);

    if (!assessment || assessment.isOutlier) {
      buckets.set(code, bucket);
      continue;
    }

    bucket.cleanCount += 1;

    if (typeof assessment.priceClean === "number" && assessment.priceClean > 0) {
      bucket.prices.push(assessment.priceClean);
    }

    if (
      typeof assessment.pricePerM2Clean === "number" &&
      Number.isFinite(assessment.pricePerM2Clean) &&
      assessment.pricePerM2Clean > 0
    ) {
      bucket.pricesPerM2.push(assessment.pricePerM2Clean);
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
      rentShare: bucket.cleanCount > 0 ? bucket.rentCount / bucket.cleanCount : 0,
      saleShare: bucket.cleanCount > 0 ? bucket.saleCount / bucket.cleanCount : 0
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
