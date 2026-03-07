import { describe, expect, it } from "bun:test";
import { getMockListings } from "./mock-repository";
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
});
