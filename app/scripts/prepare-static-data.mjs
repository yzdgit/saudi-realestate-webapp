import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const REQUIRED_HEADERS = [
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

const SOURCE_VALUES = new Set(["aqar", "bayut", "dealapp"]);
const GOAL_VALUES = new Set(["sale", "rent"]);
const LISTING_TYPE_VALUES = new Set(["residential", "commercial"]);
const RENT_FREQUENCY_VALUES = new Set(["monthly", "quarterly", "semi", "annually"]);
const PROPERTY_TYPE_VALUES = new Set([
  "apartment",
  "villa",
  "land",
  "duplex",
  "townhouse",
  "office",
  "shop",
  "warehouse",
  "building",
  "farm",
  "chalet",
  "compound",
  "floor",
  "studio",
  "room",
  "other"
]);

function toStableId(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return `lst-${Math.abs(hash).toString(36)}`;
}

function normalizeListingUri(source, uri) {
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
}

export function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

export function validateHeaders(headers) {
  if (headers.length !== REQUIRED_HEADERS.length) {
    throw new Error(
      `Invalid CSV header length. Expected ${REQUIRED_HEADERS.length}, got ${headers.length}`
    );
  }

  for (let index = 0; index < REQUIRED_HEADERS.length; index += 1) {
    const expected = REQUIRED_HEADERS[index];
    const actual = headers[index];

    if (actual !== expected) {
      throw new Error(`Invalid CSV header at index ${index}. Expected \"${expected}\", got \"${actual}\"`);
    }
  }
}

export function normalizeRentFrequency(value) {
  if (!value) {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "quartely") {
    return "quarterly";
  }

  if (!RENT_FREQUENCY_VALUES.has(normalized)) {
    throw new Error(`Invalid rent_frequency value: ${value}`);
  }

  return normalized;
}

function parseRequiredNumber(value, fieldName, rowNumber) {
  if (value === "") {
    throw new Error(`Row ${rowNumber}: ${fieldName} is required`);
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be numeric, got \"${value}\"`);
  }

  return parsed;
}

function parseOptionalNumber(value, fieldName, rowNumber) {
  if (value === "") {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Row ${rowNumber}: ${fieldName} must be numeric when present, got \"${value}\"`);
  }

  return parsed;
}

export function parseBoolean(value, fieldName = "is_active") {
  const normalized = String(value).trim().toLowerCase();

  if (["true", "t", "1", "yes", "y"].includes(normalized)) {
    return true;
  }

  if (["false", "f", "0", "no", "n", ""].includes(normalized)) {
    return false;
  }

  throw new Error(`Invalid boolean value for ${fieldName}: ${value}`);
}

export function normalizeCsvRow(row, rowNumber) {
  const source = String(row.source ?? "").trim().toLowerCase();
  if (!SOURCE_VALUES.has(source)) {
    throw new Error(`Row ${rowNumber}: invalid source \"${row.source}\"`);
  }

  const goal = String(row.goal ?? "").trim().toLowerCase();
  if (!GOAL_VALUES.has(goal)) {
    throw new Error(`Row ${rowNumber}: invalid goal \"${row.goal}\"`);
  }

  const listingType = String(row.listing_type ?? "").trim().toLowerCase();
  if (!LISTING_TYPE_VALUES.has(listingType)) {
    throw new Error(`Row ${rowNumber}: invalid listing_type \"${row.listing_type}\"`);
  }

  const propertyType = String(row.property_type ?? "").trim().toLowerCase();
  if (!PROPERTY_TYPE_VALUES.has(propertyType)) {
    throw new Error(`Row ${rowNumber}: invalid property_type \"${row.property_type}\"`);
  }

  const listingUriRaw = String(row.listing_uri ?? "").trim();
  if (!listingUriRaw) {
    throw new Error(`Row ${rowNumber}: listing_uri is required`);
  }

  const externalId = String(row.external_id ?? "").trim();
  const isActive = parseBoolean(row.is_active, "is_active");
  const normalizedRentFrequency = normalizeRentFrequency(row.rent_frequency);
  const price = parseRequiredNumber(row.price, "price", rowNumber);
  const area = parseRequiredNumber(row.area_m2, "area_m2", rowNumber);
  const latitude = parseRequiredNumber(row.latitude, "latitude", rowNumber);
  const longitude = parseRequiredNumber(row.longitude, "longitude", rowNumber);
  const rooms = parseOptionalNumber(row.rooms, "rooms", rowNumber);
  const bedrooms = parseOptionalNumber(row.bedrooms, "bedrooms", rowNumber);
  const bathrooms = parseOptionalNumber(row.bathrooms, "bathrooms", rowNumber);
  const livingRooms = parseOptionalNumber(row.living_rooms, "living_rooms", rowNumber);

  const regionCode = String(row.region_code ?? "").trim();
  const cityCode = String(row.city_code ?? "").trim();
  const districtCode = String(row.district_code ?? "").trim();

  if (!regionCode || !cityCode || !districtCode) {
    throw new Error(`Row ${rowNumber}: region_code/city_code/district_code are required`);
  }

  const listingUri = normalizeListingUri(source, listingUriRaw);
  const stableSeed = `${source}:${externalId || listingUri}:${listingUri}`;
  const id = toStableId(stableSeed);
  const pricePerM2 = area > 0 ? price / area : null;

  // Round numeric fields for compactness on disk. Stats are computed on these
  // rounded values; differences from raw CSV are well below display precision.
  const roundedPrice = Math.round(price);
  const roundedArea = Math.round(area);
  const roundedPricePerM2 =
    Number.isFinite(pricePerM2) && pricePerM2 !== null ? Math.round(pricePerM2) : null;
  // 5 decimal places ≈ 1.1 m accuracy at the equator — plenty for map clustering.
  const roundedLat = Math.round(latitude * 1e5) / 1e5;
  const roundedLng = Math.round(longitude * 1e5) / 1e5;

  return {
    isActive,
    listing: {
      id,
      source,
      goal,
      rent_frequency: normalizedRentFrequency,
      price: roundedPrice,
      area: roundedArea,
      rooms,
      bedrooms,
      bathrooms,
      living_rooms: livingRooms,
      property_type: propertyType,
      listing_type: listingType,
      region_code: regionCode,
      city_code: cityCode,
      district_code: districtCode,
      latitude: roundedLat,
      longitude: roundedLng,
      price_per_m2: roundedPricePerM2,
      listed_at: String(row.listed_at ?? "").trim()
    },
    uri: listingUri
  };
}

async function readCsvRecords(filePath, onRow) {
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const reader = readline.createInterface({
    input: stream,
    crlfDelay: Infinity
  });

  let headers = null;
  let rowNumber = 0;

  for await (const line of reader) {
    if (!line || !line.trim()) {
      continue;
    }

    rowNumber += 1;
    const values = parseCsvLine(line.replace(/\r$/, ""));

    if (!headers) {
      validateHeaders(values);
      headers = values;
      continue;
    }

    if (values.length !== headers.length) {
      throw new Error(`Row ${rowNumber}: expected ${headers.length} columns, got ${values.length}`);
    }

    const row = {};
    for (let index = 0; index < headers.length; index += 1) {
      row[headers[index]] = values[index] ?? "";
    }

    onRow(row, rowNumber);
  }

  if (!headers) {
    throw new Error("CSV file is empty or missing header");
  }
}

export async function generateStaticData({
  rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  listingsCsvPath = path.resolve(rootDir, "src", "data", "listings.csv"),
  regionsGeoJsonPath = path.resolve(rootDir, "src", "data", "regions.geojson"),
  citiesGeoJsonPath = path.resolve(rootDir, "src", "data", "cities.geojson"),
  citiesPolygonsGeoJsonPath = path.resolve(rootDir, "src", "data", "cities_polygons.geojson"),
  districtGeoJsonPath = path.resolve(rootDir, "src", "data", "districts.geojson"),
  outputDir = path.resolve(rootDir, "public", "static-data")
} = {}) {
  const listings = [];
  const uriLookup = {};
  let sourceRowCount = 0;
  let inactiveRowCount = 0;

  await readCsvRecords(listingsCsvPath, (row, rowNumber) => {
    sourceRowCount += 1;
    const normalized = normalizeCsvRow(row, rowNumber);

    if (!normalized.isActive) {
      inactiveRowCount += 1;
      return;
    }

    listings.push(normalized.listing);
    if (normalized.uri) {
      uriLookup[normalized.listing.id] = normalized.uri;
    }
  });

  const readAndValidateGeoJson = async (filePath, fileLabel) => {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);

    if (parsed?.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
      throw new Error(`${fileLabel} must be a valid GeoJSON FeatureCollection`);
    }

    return parsed;
  };

  const regionsGeoJson = await readAndValidateGeoJson(regionsGeoJsonPath, "regions.geojson");
  const citiesGeoJson = await readAndValidateGeoJson(citiesGeoJsonPath, "cities.geojson");
  const citiesPolygonsGeoJson = await readAndValidateGeoJson(citiesPolygonsGeoJsonPath, "cities_polygons.geojson");
  const districtGeoJson = await readAndValidateGeoJson(districtGeoJsonPath, "districts.geojson");

  await mkdir(outputDir, { recursive: true });

  const listingsOutputPath = path.join(outputDir, "listings.json");
  const urisOutputPath = path.join(outputDir, "listing-uris.json");
  const regionsOutputPath = path.join(outputDir, "regions.geojson");
  const citiesOutputPath = path.join(outputDir, "cities.geojson");
  const citiesPolygonsOutputPath = path.join(outputDir, "cities_polygons.geojson");
  const districtOutputPath = path.join(outputDir, "districts.geojson");

  const payload = {
    generatedAt: new Date().toISOString(),
    source: {
      csvPath: path.relative(rootDir, listingsCsvPath),
      regionsGeoJsonPath: path.relative(rootDir, regionsGeoJsonPath),
      citiesGeoJsonPath: path.relative(rootDir, citiesGeoJsonPath),
      citiesPolygonsGeoJsonPath: path.relative(rootDir, citiesPolygonsGeoJsonPath),
      districtGeoJsonPath: path.relative(rootDir, districtGeoJsonPath)
    },
    counts: {
      totalRows: sourceRowCount,
      inactiveRows: inactiveRowCount,
      activeRows: listings.length,
      regionFeatures: regionsGeoJson.features.length,
      cityFeatures: citiesGeoJson.features.length,
      cityPolygonFeatures: citiesPolygonsGeoJson.features.length,
      districtFeatures: districtGeoJson.features.length
    },
    listings
  };

  await writeFile(listingsOutputPath, JSON.stringify(payload), "utf8");
  await writeFile(urisOutputPath, JSON.stringify(uriLookup), "utf8");
  await copyFile(regionsGeoJsonPath, regionsOutputPath);
  await copyFile(citiesGeoJsonPath, citiesOutputPath);
  await copyFile(citiesPolygonsGeoJsonPath, citiesPolygonsOutputPath);
  await copyFile(districtGeoJsonPath, districtOutputPath);

  return {
    listingsOutputPath,
    urisOutputPath,
    regionsOutputPath,
    citiesOutputPath,
    citiesPolygonsOutputPath,
    districtOutputPath,
    uriCount: Object.keys(uriLookup).length,
    ...payload.counts
  };
}

async function main() {
  const result = await generateStaticData();
  console.log(
    `Prepared static data: ${result.activeRows}/${result.totalRows} active listings -> ${result.listingsOutputPath}`
  );
  console.log(`Prepared listing URI lookup (${result.uriCount} entries) -> ${result.urisOutputPath}`);
  console.log(`Prepared regions GeoJSON (${result.regionFeatures} features) -> ${result.regionsOutputPath}`);
  console.log(`Prepared cities GeoJSON (${result.cityFeatures} features) -> ${result.citiesOutputPath}`);
  console.log(`Prepared cities polygons GeoJSON (${result.cityPolygonFeatures} features) -> ${result.citiesPolygonsOutputPath}`);
  console.log(`Prepared districts GeoJSON (${result.districtFeatures} features) -> ${result.districtOutputPath}`);
}

const isExecutedDirectly = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isExecutedDirectly) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
