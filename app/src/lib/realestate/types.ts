export type ListingSource = "aqar" | "bayut" | "dealapp";

export type ListingGoal = "sale" | "rent";

export type RentFrequency = "monthly" | "quarterly" | "semi" | "annually";

export type RentFrequencyRaw = RentFrequency | "quartely";

export type PropertyType =
  | "apartment"
  | "villa"
  | "land"
  | "duplex"
  | "townhouse"
  | "office"
  | "shop"
  | "warehouse"
  | "building"
  | "farm"
  | "chalet"
  | "compound"
  | "floor"
  | "studio"
  | "room"
  | "other";

export type ListingType = "residential" | "commercial";

export type ListingSort =
  | "newest"
  | "price_asc"
  | "price_desc"
  | "area_asc"
  | "area_desc"
  | "price_per_m2_asc"
  | "price_per_m2_desc"
  | "bedrooms_desc";

export interface ListingModelRaw {
  source: ListingSource;
  listing_uri: string;
  goal: ListingGoal;
  rent_frequency?: RentFrequencyRaw;
  price: number;
  area: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  living_rooms?: number;
  property_type: PropertyType;
  listing_type: ListingType;
  region_code: string;
  city_code: string;
  district_code: string;
  latitude: number;
  longitude: number;
}

export interface Listing extends Omit<ListingModelRaw, "rent_frequency"> {
  id: string;
  rent_frequency?: RentFrequency;
  raw_rent_frequency?: RentFrequencyRaw;
  price_per_m2: number | null;
}

export interface ListingFilters {
  goal: ListingGoal;
  rent_frequency: RentFrequency[];
  property_type: PropertyType[];
  listing_type: ListingType;
  region: string[];
  city: string[];
  district: string[];
  price_min?: number;
  price_max?: number;
  area_min?: number;
  area_max?: number;
  bedrooms_min?: number;
  bathrooms_min?: number;
  rooms_min?: number;
  sort: ListingSort;
  page: number;
  in_view: boolean;
}

export interface PaginationResult<T> {
  items: T[];
  page: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
}

export interface MapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export type MapLevel = "region" | "city" | "district";

export type MapCameraIntent =
  | "initial"
  | "boundary_click"
  | "filter_change"
  | "gesture"
  | "recenter"
  | "cluster_click";

export interface MapSelectionPath {
  regionCode?: string;
  cityCode?: string;
  districtCode?: string;
  lockedByClick: boolean;
}

export interface BoundaryFeatureMeta {
  code: string;
  level: MapLevel;
  regionCode?: string;
  cityCode?: string;
  bounds: MapBounds;
  center: [number, number];
  nameAr: string;
  nameEn: string;
  feature: {
    type: "Feature";
    geometry: unknown;
    properties: Record<string, unknown>;
  };
}

export interface MapUxConfig {
  regionToCityIn: number;
  regionToCityOut: number;
  cityToDistrictIn: number;
  cityToDistrictOut: number;
  fitPaddingRatio: number;
  fitDurationSeconds: number;
  fitFallbackZoom: number;
  filterAutoFitVisibleRatioThreshold: number;
}

export interface MapViewportState {
  center: [number, number];
  zoom: number;
  bounds?: MapBounds;
  onlyInView: boolean;
}

export interface MapAreaStat {
  level: MapLevel;
  code: string;
  totalListings: number;
  meanPrice: number;
  medianPrice: number;
  meanPricePerM2: number;
  medianPricePerM2: number;
  rentShare: number;
  saleShare: number;
}

export interface LabelValueDatum {
  key: string;
  label: string;
  value: number;
}

export interface HistogramDatum {
  range: string;
  count: number;
}

export interface ScatterDatum {
  id: string;
  source: ListingSource;
  area: number;
  price: number;
  price_per_m2: number | null;
}

export interface CityGeoDatum {
  cityCode: string;
  count: number;
  avgPricePerM2: number;
  latitude: number;
  longitude: number;
}

export type GeoRankingLevel = "region" | "city" | "district";

export interface GeoRankingRow {
  code: string;
  level: GeoRankingLevel;
  count: number;
  meanPrice: number;
  medianPrice: number;
  meanPricePerM2: number;
  medianPricePerM2: number;
  rentShare: number;
  saleShare: number;
}

export interface AnalyticsSnapshot {
  totalListings: number;
  medianPrice: number;
  meanPrice: number;
  minPrice: number;
  maxPrice: number;
  medianPricePerM2: number;
  meanPricePerM2: number;
  minPricePerM2: number;
  maxPricePerM2: number;
  medianArea: number;
  meanArea: number;
  minArea: number;
  maxArea: number;
  rentShare: number;
  saleShare: number;
  goalDistribution: LabelValueDatum[];
  propertyTypeByGoal: Array<{
    propertyType: string;
    sale: number;
    rent: number;
  }>;
  cityDistribution: LabelValueDatum[];
  districtAvgPricePerM2: Array<{
    districtCode: string;
    value: number;
  }>;
  priceHistogram: HistogramDatum[];
  areaHistogram: HistogramDatum[];
  scatter: ScatterDatum[];
  cityGeo: CityGeoDatum[];
}

export interface FilterOptionSet {
  goal: ListingGoal[];
  rent_frequency: RentFrequency[];
  property_type: PropertyType[];
  listing_type: ListingType[];
  region: string[];
  city: string[];
  district: string[];
}
