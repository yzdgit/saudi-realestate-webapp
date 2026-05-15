export type NormalizedPreparedListing = {
  id: string;
  source: "aqar" | "bayut" | "dealapp";
  goal: "sale" | "rent";
  rent_frequency?: "monthly" | "quarterly" | "semi" | "annually";
  price: number;
  area: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  property_type: string;
  listing_type: "residential" | "commercial";
  region_code: string;
  city_code: string;
  district_code: string;
  latitude: number;
  longitude: number;
  price_per_m2: number | null;
  listed_at: string;
};

export type NormalizedCsvRow = {
  isActive: boolean;
  listing: NormalizedPreparedListing;
  uri?: string;
};

export type GenerateStaticDataOptions = {
  rootDir?: string;
  listingsCsvPath?: string;
  regionsGeoJsonPath?: string;
  citiesGeoJsonPath?: string;
  citiesPolygonsGeoJsonPath?: string;
  districtGeoJsonPath?: string;
  outputDir?: string;
};

export type GenerateStaticDataResult = {
  listingsOutputPath: string;
  urisOutputPath: string;
  regionsOutputPath: string;
  citiesOutputPath: string;
  citiesPolygonsOutputPath: string;
  districtOutputPath: string;
  totalRows: number;
  inactiveRows: number;
  activeRows: number;
  uriCount: number;
  regionFeatures: number;
  cityFeatures: number;
  cityPolygonFeatures: number;
  districtFeatures: number;
};

export function parseCsvLine(line: string): string[];
export function validateHeaders(headers: string[]): void;
export function normalizeRentFrequency(
  value: unknown
): "monthly" | "quarterly" | "semi" | "annually" | undefined;
export function parseBoolean(value: unknown, fieldName?: string): boolean;
export function normalizeCsvRow(row: Record<string, unknown>, rowNumber: number): NormalizedCsvRow;
export function generateStaticData(options?: GenerateStaticDataOptions): Promise<GenerateStaticDataResult>;
