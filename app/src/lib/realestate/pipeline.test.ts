import { describe, expect, it } from "bun:test";
import type { Listing } from "./types";
import {
  applyListingFilters,
  buildGeoRankingRows,
  buildAnalyticsSnapshot,
  getGeoDrillLevel,
  parseFiltersFromQuery,
  serializeFiltersToQuery
} from "./pipeline";

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "lst-base",
    source: "aqar",
    listing_uri: "https://aqar.example/listings/base",
    goal: "sale",
    rent_frequency: undefined,
    raw_rent_frequency: undefined,
    price: 1_500_000,
    area: 250,
    rooms: 6,
    bedrooms: 4,
    bathrooms: 3,
    living_rooms: 1,
    property_type: "villa",
    listing_type: "residential",
    region_code: "1",
    city_code: "3",
    district_code: "10100003075",
    latitude: 24.7138,
    longitude: 46.6753,
    price_per_m2: 6000,
    listed_at: "2026-01-15T10:00:00Z",
    ...overrides
  };
}

function getFixtureListings(): Listing[] {
  return [
    makeListing({ id: "lst-1", price: 950_000, area: 180, price_per_m2: 950_000 / 180 }),
    makeListing({
      id: "lst-2",
      goal: "rent",
      rent_frequency: "annually",
      raw_rent_frequency: "annually",
      price: 80_000,
      area: 150,
      price_per_m2: 80_000 / 150,
      property_type: "apartment"
    }),
    makeListing({
      id: "lst-3",
      city_code: "18",
      region_code: "2",
      district_code: "10200018001",
      price: 1_200_000,
      area: 220,
      price_per_m2: 1_200_000 / 220,
      latitude: 21.5291,
      longitude: 39.1725
    }),
    makeListing({
      id: "lst-4",
      city_code: "13",
      region_code: "5",
      district_code: "10500013010",
      price: 700_000,
      area: 200,
      price_per_m2: 700_000 / 200,
      latitude: 26.2734,
      longitude: 50.1996
    })
  ];
}

describe("realestate pipeline", () => {
  it("parses and serializes query filters", () => {
    const parsed = parseFiltersFromQuery({
      goal: "sale",
      region: "1,2",
      rent_frequency: "monthly,annually",
      page: "3",
      sort: "price_desc",
      in_view: "1"
    });

    expect(parsed.goal).toBe("sale");
    expect(parsed.region).toEqual(["1", "2"]);
    expect(parsed.rent_frequency).toEqual([]);
    expect(parsed.page).toBe(3);
    expect(parsed.in_view).toBe(true);

    const serialized = serializeFiltersToQuery(parsed);
    expect(serialized.goal).toBeUndefined();
    expect(serialized.region).toBe("1,2");
    expect(serialized.rent_frequency).toBeUndefined();
    expect(serialized.page).toBe("3");
    expect(serialized.in_view).toBe("1");
  });

  it("drops district filter when no city is selected", () => {
    const parsed = parseFiltersFromQuery({
      district: "10100003075"
    });

    expect(parsed.city).toEqual([]);
    expect(parsed.district).toEqual([]);

    const serialized = serializeFiltersToQuery({
      ...parsed,
      district: ["10100003075"]
    });

    expect(serialized.district).toBeUndefined();
  });

  it("filters listings by goal and price", () => {
    const listings = getFixtureListings();

    const result = applyListingFilters(listings, {
      goal: "sale",
      rent_frequency: [],
      property_type: [],
      listing_type: "residential",
      region: [],
      city: [],
      district: [],
      price_min: 900000,
      price_max: undefined,
      area_min: undefined,
      area_max: undefined,
      bedrooms_min: undefined,
      bathrooms_min: undefined,
      rooms_min: undefined,
      sort: "newest",
      page: 1,
      in_view: false
    });

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((item) => item.goal === "sale" && item.price >= 900000)).toBe(true);
  });

  it("builds analytics snapshot for filtered listings", () => {
    const listings = getFixtureListings();
    const snapshot = buildAnalyticsSnapshot(listings);

    expect(snapshot.totalListings).toBe(listings.length);
    expect(snapshot.medianPrice).toBeGreaterThan(0);
    expect(snapshot.goalDistribution.length).toBe(2);
    expect(snapshot.cityGeo.length).toBeGreaterThan(0);
  });

  it("treats zero numeric values as missing in analytics calculations", () => {
    const [base] = getFixtureListings();

    const listings: Listing[] = [
      {
        ...base,
        id: `${base.id}-zero`,
        city_code: "3",
        district_code: "10100003075",
        price: 0,
        price_per_m2: 0
      },
      {
        ...base,
        id: `${base.id}-positive`,
        city_code: "3",
        district_code: "10100003075",
        price: 1000000,
        price_per_m2: 5000
      }
    ];

    const snapshot = buildAnalyticsSnapshot(listings);

    expect(snapshot.meanPrice).toBe(1000000);
    expect(snapshot.medianPrice).toBe(1000000);
    expect(snapshot.meanPricePerM2).toBe(5000);
    expect(snapshot.medianPricePerM2).toBe(5000);
    expect(snapshot.scatter.length).toBe(1);
  });

  it("applies fixed hard-validity thresholds before analytics metrics", () => {
    const [base] = getFixtureListings();
    const validArea = 200;

    const listings: Listing[] = [
      {
        ...base,
        id: `${base.id}-hard-invalid`,
        city_code: "3",
        district_code: "10100003075",
        price: 4000,
        area: 100,
        price_per_m2: 40
      },
      {
        ...base,
        id: `${base.id}-hard-valid`,
        city_code: "3",
        district_code: "10100003075",
        price: 1000000,
        area: validArea,
        price_per_m2: 1000000 / validArea
      }
    ];

    const snapshot = buildAnalyticsSnapshot(listings);

    expect(snapshot.totalListings).toBe(2);
    expect(snapshot.meanPrice).toBe(1000000);
    expect(snapshot.medianPrice).toBe(1000000);
    expect(snapshot.scatter.length).toBe(1);
  });

  it("uses MAD + winsorization to prevent extreme outliers from distorting charts", () => {
    const [base] = getFixtureListings();
    const normalListings: Listing[] = Array.from({ length: 20 }, (_, index) => {
      const area = 200;
      const price = 1000000 + index * 10000;

      return {
        ...base,
        id: `${base.id}-normal-${index}`,
        city_code: "3",
        district_code: "10100003075",
        price,
        area,
        price_per_m2: price / area
      };
    });

    const extreme: Listing = {
      ...base,
      id: `${base.id}-extreme`,
      city_code: "3",
      district_code: "10100003075",
      price: 100000000,
      area: 500,
      price_per_m2: 200000
    };

    const listings = [...normalListings, extreme];
    const snapshot = buildAnalyticsSnapshot(listings);
    const rankings = buildGeoRankingRows(listings, "city");

    expect(snapshot.totalListings).toBe(21);
    expect(snapshot.maxPrice).toBeLessThan(2000000);
    expect(snapshot.scatter.length).toBeLessThan(21);
    expect(snapshot.scatter.length).toBeGreaterThanOrEqual(18);
    expect(rankings[0]?.count).toBe(21);
    expect(rankings[0]?.meanPrice).toBeLessThan(2000000);
  });

  it("detects outliers separately for sale and rent cohorts", () => {
    const [base] = getFixtureListings();

    const saleListings: Listing[] = Array.from({ length: 100 }, (_, index) => {
      const area = 200;
      const price = 900000 + index * 1000;
      return {
        ...base,
        id: `${base.id}-sale-${index}`,
        goal: "sale",
        city_code: "3",
        district_code: "10100003075",
        area,
        price,
        price_per_m2: price / area
      };
    });

    const rentListing: Listing = {
      ...base,
      id: `${base.id}-rent-normal`,
      goal: "rent",
      city_code: "3",
      district_code: "10100003075",
      area: 100,
      price: 60000,
      price_per_m2: 600
    };

    const snapshot = buildAnalyticsSnapshot([...saleListings, rentListing]);

    expect(snapshot.totalListings).toBe(101);
    expect(snapshot.minPrice).toBe(60000);
    expect(snapshot.meanPrice).toBeLessThan(949500);
    expect(snapshot.meanPrice).toBeGreaterThan(60000);
  });

  it("chooses geo drill level based on selected geography", () => {
    expect(getGeoDrillLevel({ region: [], city: [] })).toBe("region");
    expect(getGeoDrillLevel({ region: ["1"], city: [] })).toBe("city");
    expect(getGeoDrillLevel({ region: ["1"], city: ["3"] })).toBe("district");
  });

  it("builds geo ranking rows with expected shape", () => {
    const listings = getFixtureListings();
    const rows = buildGeoRankingRows(listings, "region");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.level).toBe("region");
    expect(rows[0]?.count).toBeGreaterThan(0);
  });

  it("treats zero values as missing in geo rankings", () => {
    const [base] = getFixtureListings();
    const listings: Listing[] = [
      {
        ...base,
        id: `${base.id}-rank-zero`,
        city_code: "3",
        district_code: "10100003075",
        price: 0,
        price_per_m2: 0
      },
      {
        ...base,
        id: `${base.id}-rank-positive`,
        city_code: "3",
        district_code: "10100003075",
        price: 2000000,
        price_per_m2: 7000
      }
    ];

    const rows = buildGeoRankingRows(listings, "city");
    expect(rows[0]?.meanPrice).toBe(2000000);
    expect(rows[0]?.medianPrice).toBe(2000000);
    expect(rows[0]?.meanPricePerM2).toBe(7000);
    expect(rows[0]?.medianPricePerM2).toBe(7000);
  });
});
