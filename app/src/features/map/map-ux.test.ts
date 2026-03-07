import { describe, expect, it } from "bun:test";
import type { BoundaryFeatureMeta, Listing, MapSelectionPath } from "@/lib/realestate/types";
import {
  MAP_UX_CONFIG,
  computeFitTarget,
  computeVisibleRatio,
  nextSelectionPathOnClick,
  resolveDisplayLevel,
  shouldAutoFit
} from "./map-ux";

const mockListings: Listing[] = [
  {
    id: "a",
    source: "aqar",
    listing_uri: "https://example.com/a",
    goal: "sale",
    price: 1_200_000,
    area: 180,
    property_type: "apartment",
    listing_type: "residential",
    region_code: "1",
    city_code: "101",
    district_code: "1001",
    latitude: 24.72,
    longitude: 46.68,
    price_per_m2: 6666.67
  },
  {
    id: "b",
    source: "bayut",
    listing_uri: "https://example.com/b",
    goal: "rent",
    rent_frequency: "monthly",
    price: 90_000,
    area: 120,
    property_type: "villa",
    listing_type: "residential",
    region_code: "1",
    city_code: "101",
    district_code: "1002",
    latitude: 24.71,
    longitude: 46.70,
    price_per_m2: 750
  }
];

function createMeta(code: string): BoundaryFeatureMeta {
  return {
    code,
    level: "city",
    regionCode: "1",
    cityCode: code,
    bounds: {
      north: 24.9,
      south: 24.5,
      east: 46.9,
      west: 46.4
    },
    center: [24.7, 46.65],
    nameAr: "مدينة",
    nameEn: "City",
    feature: {
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [] },
      properties: { city_id: code, region_id: "1", name_ar: "مدينة", name_en: "City" }
    }
  };
}

describe("map-ux", () => {
  it("resolves zoom levels with hysteresis and city gate for districts", () => {
    const emptyPath: MapSelectionPath = { lockedByClick: false };
    const cityPath: MapSelectionPath = { regionCode: "1", cityCode: "101", lockedByClick: true };

    expect(resolveDisplayLevel(6.3, emptyPath, "city")).toBe("region");
    expect(resolveDisplayLevel(7.4, emptyPath, "region")).toBe("city");
    expect(resolveDisplayLevel(11.2, emptyPath, "city")).toBe("city");
    expect(resolveDisplayLevel(11.2, cityPath, "city")).toBe("district");
    expect(resolveDisplayLevel(9.5, cityPath, "district")).toBe("city");
  });

  it("handles click selection and step-up toggles", () => {
    const base: MapSelectionPath = { lockedByClick: false };
    const selectedRegion = nextSelectionPathOnClick("region", "1", base, true);
    expect(selectedRegion.regionCode).toBe("1");
    expect(selectedRegion.cityCode).toBeUndefined();

    const selectedCity = nextSelectionPathOnClick("city", "101", selectedRegion, true, {
      regionCode: "1"
    });
    expect(selectedCity.regionCode).toBe("1");
    expect(selectedCity.cityCode).toBe("101");
    expect(selectedCity.districtCode).toBeUndefined();

    const selectedDistrict = nextSelectionPathOnClick("district", "1001", selectedCity, true, {
      regionCode: "1",
      cityCode: "101"
    });
    expect(selectedDistrict.districtCode).toBe("1001");

    const steppedUp = nextSelectionPathOnClick("district", "1001", selectedDistrict, true, {
      regionCode: "1",
      cityCode: "101"
    });
    expect(steppedUp.districtCode).toBeUndefined();
    expect(steppedUp.cityCode).toBe("101");
  });

  it("auto-fit policy follows intent and visibility threshold", () => {
    expect(
      shouldAutoFit("boundary_click", {
        inView: false,
        visibleRatio: 0.95,
        hasMapBounds: true
      })
    ).toBe(true);

    expect(
      shouldAutoFit("gesture", {
        inView: false,
        visibleRatio: 0.2,
        hasMapBounds: true
      })
    ).toBe(false);

    expect(
      shouldAutoFit("filter_change", {
        inView: true,
        visibleRatio: 0.1,
        hasMapBounds: true
      })
    ).toBe(false);

    expect(
      shouldAutoFit("filter_change", {
        inView: false,
        visibleRatio: MAP_UX_CONFIG.filterAutoFitVisibleRatioThreshold - 0.01,
        hasMapBounds: true
      })
    ).toBe(true);

    expect(
      shouldAutoFit("filter_change", {
        inView: false,
        visibleRatio: MAP_UX_CONFIG.filterAutoFitVisibleRatioThreshold + 0.01,
        hasMapBounds: true
      })
    ).toBe(false);
  });

  it("computes visible ratio and fit targets", () => {
    const ratio = computeVisibleRatio(mockListings, {
      north: 24.73,
      south: 24.715,
      east: 46.69,
      west: 46.67
    });

    expect(ratio).toBe(0.5);

    const cityMeta = createMeta("101");
    const target = computeFitTarget(
      {
        regionCode: "1",
        cityCode: "101",
        lockedByClick: true
      },
      {
        regionByCode: new Map([["1", cityMeta]]),
        cityByCode: new Map([["101", cityMeta]]),
        districtByCode: new Map()
      },
      mockListings
    );

    expect(target.kind).toBe("bounds");
    if (target.kind === "bounds") {
      expect(target.bounds.north).toBe(24.9);
      expect(target.bounds.west).toBe(46.4);
    }
  });
});
