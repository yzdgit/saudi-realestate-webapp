import type {
  BoundaryFeatureMeta,
  Listing,
  MapBounds,
  MapCameraIntent,
  MapLevel,
  MapSelectionPath,
  MapUxConfig
} from "@/lib/realestate/types";

export const MAP_UX_CONFIG: MapUxConfig = {
  regionToCityIn: 7.2,
  regionToCityOut: 6.4,
  cityToDistrictIn: 10.4,
  cityToDistrictOut: 9.6,
  fitPaddingRatio: 0.08,
  fitDurationSeconds: 0.35,
  fitFallbackZoom: 7,
  filterAutoFitVisibleRatioThreshold: 0.4
};

export type MapFitTarget =
  | {
      kind: "bounds";
      bounds: MapBounds;
    }
  | {
      kind: "center";
      center: [number, number];
      zoom: number;
    };

export type BoundaryMetaLookup = {
  regionByCode: Map<string, BoundaryFeatureMeta>;
  cityByCode: Map<string, BoundaryFeatureMeta>;
  districtByCode: Map<string, BoundaryFeatureMeta>;
};

export type SelectionParentContext = {
  regionCode?: string;
  cityCode?: string;
};

export function resolveDisplayLevel(
  zoom: number,
  selectionPath: MapSelectionPath,
  prevLevel: MapLevel,
  config: MapUxConfig = MAP_UX_CONFIG
): MapLevel {
  const hasCitySelection = Boolean(selectionPath.cityCode);
  const hasDistrictSelection = Boolean(selectionPath.districtCode);

  if (prevLevel === "region") {
    if (zoom < config.regionToCityIn) {
      return "region";
    }

    if (hasCitySelection && zoom >= config.cityToDistrictIn) {
      return "district";
    }

    return "city";
  }

  if (prevLevel === "city") {
    if (zoom <= config.regionToCityOut) {
      return "region";
    }

    if (hasCitySelection && zoom >= config.cityToDistrictIn) {
      return "district";
    }

    return "city";
  }

  if (!hasCitySelection || zoom <= config.cityToDistrictOut) {
    if (zoom <= config.regionToCityOut && !hasDistrictSelection) {
      return "region";
    }

    return "city";
  }

  return "district";
}

export function nextSelectionPathOnClick(
  level: MapLevel,
  code: string,
  currentPath: MapSelectionPath,
  selectable: boolean,
  parentContext: SelectionParentContext = {}
): MapSelectionPath {
  if (!selectable || !code) {
    return currentPath;
  }

  if (level === "region") {
    if (currentPath.regionCode === code && !currentPath.cityCode && !currentPath.districtCode) {
      return { lockedByClick: false };
    }

    return {
      regionCode: code,
      cityCode: undefined,
      districtCode: undefined,
      lockedByClick: true
    };
  }

  if (level === "city") {
    const nextRegionCode = parentContext.regionCode ?? currentPath.regionCode;

    if (currentPath.cityCode === code && !currentPath.districtCode) {
      return {
        regionCode: nextRegionCode,
        cityCode: undefined,
        districtCode: undefined,
        lockedByClick: true
      };
    }

    return {
      regionCode: nextRegionCode,
      cityCode: code,
      districtCode: undefined,
      lockedByClick: true
    };
  }

  const nextRegionCode = parentContext.regionCode ?? currentPath.regionCode;
  const nextCityCode = parentContext.cityCode ?? currentPath.cityCode;

  if (currentPath.districtCode === code) {
    return {
      regionCode: nextRegionCode,
      cityCode: nextCityCode,
      districtCode: undefined,
      lockedByClick: true
    };
  }

  return {
    regionCode: nextRegionCode,
    cityCode: nextCityCode,
    districtCode: code,
    lockedByClick: true
  };
}

export type ShouldAutoFitContext = {
  inView: boolean;
  visibleRatio: number;
  hasMapBounds: boolean;
};

export function shouldAutoFit(
  intent: MapCameraIntent,
  context: ShouldAutoFitContext,
  config: MapUxConfig = MAP_UX_CONFIG
): boolean {
  if (intent === "gesture") {
    return false;
  }

  if (intent === "boundary_click" || intent === "cluster_click" || intent === "recenter" || intent === "initial") {
    return true;
  }

  if (intent !== "filter_change") {
    return false;
  }

  if (context.inView) {
    return false;
  }

  if (!context.hasMapBounds) {
    return true;
  }

  return context.visibleRatio < config.filterAutoFitVisibleRatioThreshold;
}

export function computeVisibleRatio(listings: Listing[], bounds: MapBounds | undefined): number {
  if (listings.length === 0) {
    return 1;
  }

  if (!bounds) {
    return 0;
  }

  let visible = 0;

  for (const listing of listings) {
    if (
      listing.latitude >= bounds.south &&
      listing.latitude <= bounds.north &&
      listing.longitude >= bounds.west &&
      listing.longitude <= bounds.east
    ) {
      visible += 1;
    }
  }

  return visible / listings.length;
}

function boundsFromListings(listings: Listing[]): MapBounds | undefined {
  if (listings.length === 0) {
    return undefined;
  }

  let north = listings[0].latitude;
  let south = listings[0].latitude;
  let east = listings[0].longitude;
  let west = listings[0].longitude;

  for (const listing of listings) {
    if (listing.latitude > north) {
      north = listing.latitude;
    }

    if (listing.latitude < south) {
      south = listing.latitude;
    }

    if (listing.longitude > east) {
      east = listing.longitude;
    }

    if (listing.longitude < west) {
      west = listing.longitude;
    }
  }

  return { north, south, east, west };
}

function centerFromListings(listings: Listing[]): [number, number] {
  if (listings.length === 0) {
    return [24.7136, 46.6753];
  }

  const latTotal = listings.reduce((sum, listing) => sum + listing.latitude, 0);
  const lngTotal = listings.reduce((sum, listing) => sum + listing.longitude, 0);

  return [latTotal / listings.length, lngTotal / listings.length];
}

export function computeFitTarget(
  selectionPath: MapSelectionPath,
  boundaryMetaLookup: BoundaryMetaLookup,
  listings: Listing[],
  config: MapUxConfig = MAP_UX_CONFIG
): MapFitTarget {
  if (selectionPath.districtCode) {
    const selected = boundaryMetaLookup.districtByCode.get(selectionPath.districtCode);
    if (selected) {
      return { kind: "bounds", bounds: selected.bounds };
    }
  }

  if (selectionPath.cityCode) {
    const selected = boundaryMetaLookup.cityByCode.get(selectionPath.cityCode);
    if (selected) {
      return { kind: "bounds", bounds: selected.bounds };
    }
  }

  if (selectionPath.regionCode) {
    const selected = boundaryMetaLookup.regionByCode.get(selectionPath.regionCode);
    if (selected) {
      return { kind: "bounds", bounds: selected.bounds };
    }
  }

  const listingBounds = boundsFromListings(listings);
  if (listingBounds) {
    return { kind: "bounds", bounds: listingBounds };
  }

  return {
    kind: "center",
    center: centerFromListings(listings),
    zoom: config.fitFallbackZoom
  };
}
