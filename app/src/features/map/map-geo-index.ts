import type { BoundaryFeatureMeta, MapBounds, MapLevel } from "@/lib/realestate/types";

export type GeoFeature = BoundaryFeatureMeta["feature"];

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type BoundaryIndex = {
  level: MapLevel;
  collection: GeoFeatureCollection;
  all: BoundaryFeatureMeta[];
  byCode: Map<string, BoundaryFeatureMeta>;
};

function toCode(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  return "";
}

function codeForLevel(feature: GeoFeature, level: MapLevel): string {
  if (level === "region") {
    return toCode(feature.properties.region_id);
  }

  if (level === "city") {
    return toCode(feature.properties.city_id);
  }

  return toCode(feature.properties.district_id);
}

function getNameAr(feature: GeoFeature): string {
  const value = feature.properties.name_ar;
  return typeof value === "string" ? value : "";
}

function getNameEn(feature: GeoFeature): string {
  const value = feature.properties.name_en;
  return typeof value === "string" ? value : "";
}

function toFiniteNumber(value: unknown): number | undefined {
  const normalized = typeof value === "number" ? value : Number(value);
  return Number.isFinite(normalized) ? normalized : undefined;
}

type BoundsAccumulator = {
  north: number;
  south: number;
  east: number;
  west: number;
  seen: boolean;
};

function createAccumulator(): BoundsAccumulator {
  return {
    north: Number.NEGATIVE_INFINITY,
    south: Number.POSITIVE_INFINITY,
    east: Number.NEGATIVE_INFINITY,
    west: Number.POSITIVE_INFINITY,
    seen: false
  };
}

function pushCoord(acc: BoundsAccumulator, coord: unknown): void {
  if (!Array.isArray(coord) || coord.length < 2) {
    return;
  }

  const lng = Number(coord[0]);
  const lat = Number(coord[1]);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  acc.seen = true;
  if (lat > acc.north) {
    acc.north = lat;
  }
  if (lat < acc.south) {
    acc.south = lat;
  }
  if (lng > acc.east) {
    acc.east = lng;
  }
  if (lng < acc.west) {
    acc.west = lng;
  }
}

function walkCoords(acc: BoundsAccumulator, value: unknown): void {
  if (!Array.isArray(value)) {
    return;
  }

  if (value.length >= 2 && typeof value[0] === "number" && typeof value[1] === "number") {
    pushCoord(acc, value);
    return;
  }

  for (const item of value) {
    walkCoords(acc, item);
  }
}

function boundsFromGeometry(geometry: unknown): MapBounds | undefined {
  const candidate = geometry as { type?: string; coordinates?: unknown; geometries?: unknown[] } | null;

  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }

  const acc = createAccumulator();

  if (candidate.type === "GeometryCollection" && Array.isArray(candidate.geometries)) {
    for (const child of candidate.geometries) {
      walkCoords(acc, (child as { coordinates?: unknown })?.coordinates);
    }
  } else {
    walkCoords(acc, candidate.coordinates);
  }

  if (!acc.seen) {
    return undefined;
  }

  return {
    north: acc.north,
    south: acc.south,
    east: acc.east,
    west: acc.west
  };
}

function centerFromBounds(bounds: MapBounds): [number, number] {
  return [(bounds.north + bounds.south) / 2, (bounds.east + bounds.west) / 2];
}

function boundsFromProperties(feature: GeoFeature): MapBounds | undefined {
  const north = toFiniteNumber(feature.properties.bounds_north);
  const south = toFiniteNumber(feature.properties.bounds_south);
  const east = toFiniteNumber(feature.properties.bounds_east);
  const west = toFiniteNumber(feature.properties.bounds_west);

  if (
    typeof north !== "number" ||
    typeof south !== "number" ||
    typeof east !== "number" ||
    typeof west !== "number"
  ) {
    return undefined;
  }

  if (north < south || east < west) {
    return undefined;
  }

  return { north, south, east, west };
}

function centerFromProperties(feature: GeoFeature): [number, number] | undefined {
  const latitude = toFiniteNumber(feature.properties.center_lat);
  const longitude = toFiniteNumber(feature.properties.center_lng);

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return undefined;
  }

  return [latitude, longitude];
}

export function normalizeBoundaryCollection(data: GeoFeatureCollection): GeoFeatureCollection {
  const normalized = data.features
    .map((feature) => {
      const geometry = feature.geometry as { type?: string; geometries?: unknown[] } | null;

      if (geometry?.type !== "GeometryCollection" || !Array.isArray(geometry.geometries)) {
        return feature;
      }

      const polygon = geometry.geometries.find((item) => {
        const candidate = item as { type?: string };
        return candidate.type === "Polygon" || candidate.type === "MultiPolygon";
      });

      if (!polygon) {
        return null;
      }

      return {
        ...feature,
        geometry: polygon
      };
    })
    .filter((feature): feature is GeoFeature => Boolean(feature));

  return {
    type: "FeatureCollection",
    features: normalized
  };
}

export function buildBoundaryIndex(level: MapLevel, collection: GeoFeatureCollection): BoundaryIndex {
  const all: BoundaryFeatureMeta[] = [];
  const byCode = new Map<string, BoundaryFeatureMeta>();

  for (const feature of collection.features) {
    const code = codeForLevel(feature, level);
    if (!code) {
      continue;
    }

    const bounds =
      boundsFromProperties(feature) ??
      boundsFromGeometry(feature.geometry) ?? {
        north: 24.7141,
        south: 24.7131,
        east: 46.6758,
        west: 46.6748
      };

    const center = centerFromProperties(feature) ?? centerFromBounds(bounds);

    const meta: BoundaryFeatureMeta = {
      code,
      level,
      regionCode: toCode(feature.properties.region_id) || undefined,
      cityCode: toCode(feature.properties.city_id) || undefined,
      bounds,
      center,
      nameAr: getNameAr(feature),
      nameEn: getNameEn(feature),
      feature
    };

    all.push(meta);
    byCode.set(code, meta);
  }

  return {
    level,
    collection,
    all,
    byCode
  };
}
