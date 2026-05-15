import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  generateStaticData,
  normalizeCsvRow,
  normalizeRentFrequency,
  parseBoolean,
  parseCsvLine,
  validateHeaders
} from "./prepare-static-data.mjs";

const HEADER = [
  "source",
  "external_id",
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
  "listed_at",
  "is_active"
];

describe("prepare-static-data", () => {
  it("parses CSV lines with quoted commas", () => {
    const line = 'aqar,1,"https://example.com/a,b",sale,,120000,100,,,,,apartment,residential,1,3,10100003075,24.7,46.6,2026-01-01,True';
    const values = parseCsvLine(line);

    expect(values[2]).toBe("https://example.com/a,b");
    expect(values.length).toBe(20);
  });

  it("validates strict header order", () => {
    expect(() => validateHeaders(HEADER)).not.toThrow();
    expect(() => validateHeaders([...HEADER].reverse())).toThrow();
  });

  it("normalizes rent frequency and booleans", () => {
    expect(normalizeRentFrequency("quartely")).toBe("quarterly");
    expect(parseBoolean("True")).toBe(true);
    expect(parseBoolean("0")).toBe(false);
  });

  it("normalizes CSV row shape and derives price_per_m2 + id", () => {
    const row = {
      source: "aqar",
      external_id: "123",
      listing_uri: "https://sa.aqar.fm/example",
      goal: "sale",
      rent_frequency: "",
      price: "1000000",
      area_m2: "200",
      rooms: "5",
      bedrooms: "4",
      bathrooms: "3",
      living_rooms: "1",
      property_type: "villa",
      listing_type: "residential",
      region_code: "1",
      city_code: "3",
      district_code: "10100003075",
      latitude: "24.7136",
      longitude: "46.6753",
      listed_at: "2026-01-01 10:00:00",
      is_active: "True"
    };

    const normalized = normalizeCsvRow(row, 2);

    expect(normalized.isActive).toBe(true);
    expect(normalized.listing.id.startsWith("lst-")).toBe(true);
    expect(normalized.listing.price_per_m2).toBe(5000);
    expect(normalized.listing.rooms).toBe(5);
  });

  it("rejects invalid enums and numbers", () => {
    expect(() =>
      normalizeCsvRow(
        {
          source: "invalid",
          external_id: "",
          listing_uri: "https://example.com",
          goal: "sale",
          rent_frequency: "",
          price: "100",
          area_m2: "100",
          rooms: "",
          bedrooms: "",
          bathrooms: "",
          living_rooms: "",
          property_type: "apartment",
          listing_type: "residential",
          region_code: "1",
          city_code: "3",
          district_code: "10100003075",
          latitude: "24.7",
          longitude: "46.6",
          listed_at: "",
          is_active: "True"
        },
        2
      )
    ).toThrow();
  });

  it("generates static data and filters out inactive rows", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "prepare-static-data-"));
    const listingsCsvPath = path.join(rootDir, "listings.csv");
    const regionsGeoJsonPath = path.join(rootDir, "regions.geojson");
    const citiesGeoJsonPath = path.join(rootDir, "cities.geojson");
    const citiesPolygonsGeoJsonPath = path.join(rootDir, "cities_polygons.geojson");
    const districtGeoJsonPath = path.join(rootDir, "districts.geojson");
    const outputDir = path.join(rootDir, "static-data");

    const csvLines = [
      HEADER.join(","),
      "aqar,123,https://sa.aqar.fm/active,sale,,1000000,200,5,4,3,1,villa,residential,1,3,10100003075,24.7136,46.6753,2026-01-01,True",
      "bayut,456,https://www.bayut.sa/property/inactive,rent,quartely,120000,120,4,3,2,1,apartment,residential,1,3,10100003148,24.89,46.61,2026-01-02,False"
    ];

    await writeFile(listingsCsvPath, `${csvLines.join("\n")}\n`, "utf8");
    const minimalCollection = (featureProps: Record<string, unknown>) =>
      JSON.stringify({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: featureProps,
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [46.6, 24.7],
                  [46.7, 24.7],
                  [46.7, 24.8],
                  [46.6, 24.8],
                  [46.6, 24.7]
                ]
              ]
            }
          }
        ]
      });

    await writeFile(regionsGeoJsonPath, minimalCollection({ region_id: "1" }), "utf8");
    await writeFile(citiesGeoJsonPath, minimalCollection({ city_id: "3", region_id: "1" }), "utf8");
    await writeFile(citiesPolygonsGeoJsonPath, minimalCollection({ city_id: "3", region_id: "1" }), "utf8");
    await writeFile(
      districtGeoJsonPath,
      minimalCollection({ district_id: "10100003075", city_id: "3", region_id: "1" }),
      "utf8"
    );

    try {
      const result = await generateStaticData({
        rootDir,
        listingsCsvPath,
        regionsGeoJsonPath,
        citiesGeoJsonPath,
        citiesPolygonsGeoJsonPath,
        districtGeoJsonPath,
        outputDir
      });

      expect(result.totalRows).toBe(2);
      expect(result.inactiveRows).toBe(1);
      expect(result.activeRows).toBe(1);
      expect(result.regionFeatures).toBe(1);
      expect(result.cityFeatures).toBe(1);
      expect(result.cityPolygonFeatures).toBe(1);
      expect(result.districtFeatures).toBe(1);

      const payload = JSON.parse(await readFile(path.join(outputDir, "listings.json"), "utf8")) as {
        listings: Array<{
          id: string;
          rent_frequency?: string;
          price_per_m2: number | null;
        }>;
      };

      expect(payload.listings.length).toBe(1);
      expect(payload.listings[0]?.id.startsWith("lst-")).toBe(true);
      expect(payload.listings[0]?.price_per_m2).toBe(5000);
      expect(payload.listings[0]?.rent_frequency).toBeUndefined();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
