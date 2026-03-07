import { mockListingsRaw } from "@/lib/realestate/mock-data";
import { getDistrictCityCode, getDistrictRegionCode } from "@/lib/location-codes";
import type {
  FilterOptionSet,
  Listing,
  ListingModelRaw,
  ListingType,
  ListingGoal,
  PropertyType,
  RentFrequency,
  RentFrequencyRaw
} from "@/lib/realestate/types";

const toStableId = (value: string) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return `lst-${Math.abs(hash).toString(36)}`;
};

export function normalizeRentFrequency(value: RentFrequencyRaw | undefined): RentFrequency | undefined {
  if (!value) {
    return undefined;
  }

  if (value === "quartely") {
    return "quarterly";
  }

  return value;
}

function normalizeListing(raw: ListingModelRaw): Listing {
  const normalizedRent = normalizeRentFrequency(raw.rent_frequency);
  const pricePerM2 = raw.area > 0 ? raw.price / raw.area : null;
  const parentCityCode = getDistrictCityCode(raw.district_code);
  const parentRegionCode = getDistrictRegionCode(raw.district_code);

  return {
    ...raw,
    city_code: parentCityCode ?? raw.city_code,
    region_code: parentRegionCode ?? raw.region_code,
    id: toStableId(`${raw.source}:${raw.listing_uri}`),
    raw_rent_frequency: raw.rent_frequency,
    rent_frequency: normalizedRent,
    price_per_m2: Number.isFinite(pricePerM2) ? pricePerM2 : null
  };
}

let listingsCache: Listing[] | null = null;

export function getMockListings(): Listing[] {
  if (!listingsCache) {
    listingsCache = mockListingsRaw.map(normalizeListing);
  }

  return listingsCache;
}

function uniqueSorted<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items)).sort((left, right) => left.localeCompare(right)) as T[];
}

export function getFilterOptions(listings = getMockListings()): FilterOptionSet {
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
