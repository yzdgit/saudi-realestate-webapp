import { describe, expect, it } from "bun:test";
import { getMockListings } from "./mock-repository";
import type { Listing } from "./types";
import {
  applyListingFilters,
  buildGeoRankingRows,
  buildAnalyticsSnapshot,
  getGeoDrillLevel,
  parseFiltersFromQuery,
  serializeFiltersToQuery
} from "./pipeline";

describe("realestate pipeline", () => {
  it("parses and serializes query filters", () => {
    const parsed = parseFiltersFromQuery({
      goal: "sale",
      region: "1,2",
      page: "3",
      sort: "price_desc",
      in_view: "1"
    });

    expect(parsed.goal).toBe("sale");
    expect(parsed.region).toEqual(["1", "2"]);
    expect(parsed.page).toBe(3);
    expect(parsed.in_view).toBe(true);

    const serialized = serializeFiltersToQuery(parsed);
    expect(serialized.goal).toBeUndefined();
    expect(serialized.region).toBe("1,2");
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
    const listings = getMockListings();

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
    const listings = getMockListings();
    const snapshot = buildAnalyticsSnapshot(listings);

    expect(snapshot.totalListings).toBe(listings.length);
    expect(snapshot.medianPrice).toBeGreaterThan(0);
    expect(snapshot.goalDistribution.length).toBe(2);
    expect(snapshot.cityGeo.length).toBeGreaterThan(0);
  });

  it("treats zero numeric values as missing in analytics calculations", () => {
    const [base] = getMockListings();

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

  it("chooses geo drill level based on selected geography", () => {
    expect(getGeoDrillLevel({ region: [], city: [] })).toBe("region");
    expect(getGeoDrillLevel({ region: ["1"], city: [] })).toBe("city");
    expect(getGeoDrillLevel({ region: ["1"], city: ["3"] })).toBe("district");
  });

  it("builds geo ranking rows with expected shape", () => {
    const listings = getMockListings();
    const rows = buildGeoRankingRows(listings, "region");

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.level).toBe("region");
    expect(rows[0]?.count).toBeGreaterThan(0);
  });

  it("treats zero values as missing in geo rankings", () => {
    const [base] = getMockListings();
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
