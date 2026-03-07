import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import L from "leaflet";
import Supercluster from "supercluster";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents
} from "react-leaflet";
import type { ExplorerMode } from "@/lib/explorer-mode";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber } from "@/lib/format";
import {
  getCityLabel,
  getCityRegionCode,
  getDistrictCityCode,
  getDistrictLabel,
  getDistrictRegionCode
} from "@/lib/location-codes";
import type {
  BoundaryFeatureMeta,
  Listing,
  ListingFilters,
  MapBounds,
  MapCameraIntent,
  MapLevel,
  MapSelectionPath
} from "@/lib/realestate/types";
import { CurrencyValue } from "@/components/ui/currency-value";
import {
  buildBoundaryIndex,
  normalizeBoundaryCollection,
  type BoundaryIndex,
  type GeoFeature,
  type GeoFeatureCollection
} from "@/features/map/map-geo-index";
import {
  MAP_UX_CONFIG,
  computeFitTarget,
  computeVisibleRatio,
  nextSelectionPathOnClick,
  resolveDisplayLevel,
  shouldAutoFit,
  type BoundaryMetaLookup,
  type MapFitTarget
} from "@/features/map/map-ux";

export type MapOverlayMode = "markers" | "intensity";

export type MapHierarchyStatus = {
  level: MapLevel;
  regionCode?: string;
  cityCode?: string;
  districtCode?: string;
  boundaryCount: number;
  selectableCount: number;
};

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  filters: ListingFilters;
  listings: Listing[];
  overlayMode: MapOverlayMode;
  mode: ExplorerMode;
  recenterSignal?: number;
  onPatchFilters: (patch: Partial<ListingFilters>) => void;
  onSelectListing: (listing: Listing) => void;
  onViewportChange?: (bounds: MapBounds) => void;
  onHierarchyChange?: (status: MapHierarchyStatus) => void;
  className?: string;
};

type PointProperties = {
  listingId: string;
};

type MapStatePayload = {
  bounds: MapBounds;
  zoom: number;
};

type AreaStats = {
  totalListings: number;
  medianPrice: number;
  medianPricePerM2: number;
};

const markerIcon = L.divIcon({
  html: '<span style="display:block;width:12px;height:12px;border-radius:9999px;background:#ffffff;border:2px solid rgba(15,23,42,0.9);"></span>',
  className: "",
  iconSize: [12, 12],
  iconAnchor: [6, 6]
});

const LEVEL_COLORS: Record<MapLevel, { stroke: string; fill: string }> = {
  region: {
    stroke: "#22c55e",
    fill: "#16a34a"
  },
  city: {
    stroke: "#eab308",
    fill: "#ca8a04"
  },
  district: {
    stroke: "#3b82f6",
    fill: "#2563eb"
  }
};

function sameBounds(left: MapBounds | undefined, right: MapBounds): boolean {
  if (!left) {
    return false;
  }

  return (
    left.north === right.north &&
    left.south === right.south &&
    left.east === right.east &&
    left.west === right.west
  );
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  }

  return sorted[midpoint];
}

function featureCode(feature: GeoFeature, level: MapLevel): string {
  if (level === "region") {
    return String(feature.properties.region_id ?? "");
  }

  if (level === "city") {
    return String(feature.properties.city_id ?? "");
  }

  return String(feature.properties.district_id ?? "");
}

function statsByCodeForLevel(level: MapLevel, listings: Listing[]): Map<string, AreaStats> {
  const grouped = new Map<string, Listing[]>();

  for (const listing of listings) {
    const code =
      level === "region"
        ? listing.region_code
        : level === "city"
          ? listing.city_code
          : listing.district_code;

    const bucket = grouped.get(code) ?? [];
    bucket.push(listing);
    grouped.set(code, bucket);
  }

  const result = new Map<string, AreaStats>();

  for (const [code, items] of grouped.entries()) {
    const prices = items.map((item) => item.price).filter((value) => Number.isFinite(value));
    const pricesPerM2 = items
      .map((item) => item.price_per_m2)
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    result.set(code, {
      totalListings: items.length,
      medianPrice: median(prices),
      medianPricePerM2: median(pricesPerM2)
    });
  }

  return result;
}

function displayLabel(meta: BoundaryFeatureMeta, locale: Locale): string {
  if (locale === "ar" && meta.nameAr) {
    return meta.nameAr;
  }

  if (meta.nameEn) {
    return meta.nameEn;
  }

  return meta.nameAr || meta.code;
}

function deriveSelectionPath(filters: ListingFilters, lockedByClick: boolean): MapSelectionPath {
  const districtCode = filters.district[0];
  const cityCodeFromFilter = filters.city[0];
  const regionCodeFromFilter = filters.region[0];

  const cityCode = districtCode ? cityCodeFromFilter ?? getDistrictCityCode(districtCode) : cityCodeFromFilter;

  const regionCode = districtCode
    ? regionCodeFromFilter ?? getDistrictRegionCode(districtCode)
    : cityCode
      ? regionCodeFromFilter ?? getCityRegionCode(cityCode)
      : regionCodeFromFilter;

  return {
    regionCode,
    cityCode,
    districtCode,
    lockedByClick
  };
}

function pathToFilterPatch(path: MapSelectionPath): Partial<ListingFilters> {
  return {
    region: path.regionCode ? [path.regionCode] : [],
    city: path.cityCode ? [path.cityCode] : [],
    district: path.districtCode ? [path.districtCode] : []
  };
}

function mapBoundsToLatLngBounds(bounds: MapBounds): L.LatLngBounds {
  return L.latLngBounds(
    [bounds.south, bounds.west],
    [bounds.north, bounds.east]
  );
}

function MapStateBridge({
  onMapReady,
  onStateChange,
  onGestureStart
}: {
  onMapReady: (map: L.Map | null) => void;
  onStateChange: (payload: MapStatePayload) => void;
  onGestureStart: () => void;
}) {
  const map = useMapEvents({
    movestart(event) {
      if ((event as L.LeafletEvent & { originalEvent?: unknown }).originalEvent) {
        onGestureStart();
      }
    },
    zoomstart(event) {
      if ((event as L.LeafletEvent & { originalEvent?: unknown }).originalEvent) {
        onGestureStart();
      }
    },
    moveend() {
      const bounds = map.getBounds();
      onStateChange({
        zoom: map.getZoom(),
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        }
      });
    },
    zoomend() {
      const bounds = map.getBounds();
      onStateChange({
        zoom: map.getZoom(),
        bounds: {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        }
      });
    }
  });

  useEffect(() => {
    onMapReady(map);

    const bounds = map.getBounds();
    onStateChange({
      zoom: map.getZoom(),
      bounds: {
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        west: bounds.getWest()
      }
    });

    return () => {
      onMapReady(null);
    };
  }, [map, onMapReady, onStateChange]);

  return null;
}

function intensityColor(value: number, min: number, max: number): string {
  if (max <= min) {
    return "#22d3ee";
  }

  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));

  if (ratio > 0.8) {
    return "#f97316";
  }

  if (ratio > 0.6) {
    return "#f59e0b";
  }

  if (ratio > 0.4) {
    return "#84cc16";
  }

  if (ratio > 0.2) {
    return "#22d3ee";
  }

  return "#38bdf8";
}

function ClusterLayer({
  clusterFeatures,
  clusterIndex,
  listingById,
  locale,
  messages,
  onSelectListing,
  onClusterMove
}: {
  clusterFeatures: Array<
    Supercluster.ClusterFeature<Supercluster.AnyProps> | Supercluster.PointFeature<PointProperties>
  >;
  clusterIndex: Supercluster<PointProperties, Supercluster.AnyProps>;
  listingById: Map<string, Listing>;
  locale: Locale;
  messages: LocaleMessages;
  onSelectListing: (listing: Listing) => void;
  onClusterMove: (center: [number, number], zoom: number) => void;
}) {
  return (
    <>
      {clusterFeatures.map((feature) => {
        const [longitude, latitude] = feature.geometry.coordinates as [number, number];
        const properties = feature.properties as {
          cluster?: boolean;
          cluster_id?: number;
          point_count?: number;
          listingId?: string;
        };

        if (properties.cluster && typeof properties.cluster_id === "number") {
          const count = properties.point_count ?? 0;
          const radius = Math.min(28, 10 + count * 0.55);

          return (
            <CircleMarker
              key={`cluster-${properties.cluster_id}`}
              center={[latitude, longitude]}
              radius={radius}
              pane="cluster-pane"
              pathOptions={{
                color: "#22d3ee",
                fillColor: "#0e7490",
                fillOpacity: 0.65,
                weight: 1.5
              }}
              eventHandlers={{
                click: () => {
                  const zoom = clusterIndex.getClusterExpansionZoom(properties.cluster_id as number);
                  onClusterMove([latitude, longitude], Math.min(zoom, 16));
                }
              }}
            >
              <Popup>
                <div className="text-xs">
                  {count} {messages.kpi.total_listings}
                </div>
              </Popup>
            </CircleMarker>
          );
        }

        if (!properties.listingId) {
          return null;
        }

        const listing = listingById.get(properties.listingId);

        if (!listing) {
          return null;
        }

        return (
          <Marker
            key={listing.id}
            position={[latitude, longitude]}
            icon={markerIcon}
            pane="listing-pane"
            eventHandlers={{
              click: () => onSelectListing(listing)
            }}
          >
            <Popup>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">
                  <CurrencyValue value={listing.price} locale={locale} />
                </p>
                <p>
                  {getCityLabel(listing.city_code, locale)} · {getDistrictLabel(listing.district_code, locale)}
                </p>
                <p>{messages.property_type[listing.property_type]}</p>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

function BoundaryGeoJsonLayer({
  collection,
  level,
  selectedCode,
  colors,
  intensityMode,
  valueByCode,
  minValue,
  maxValue,
  locale,
  messages,
  statsByCode,
  isSelectable,
  metaByCode,
  onAreaClick
}: {
  collection: GeoFeatureCollection;
  level: MapLevel;
  selectedCode?: string;
  colors: { stroke: string; fill: string };
  intensityMode: boolean;
  valueByCode: Map<string, number>;
  minValue: number;
  maxValue: number;
  locale: Locale;
  messages: LocaleMessages;
  statsByCode: Map<string, AreaStats>;
  isSelectable: (code: string) => boolean;
  metaByCode: Map<string, BoundaryFeatureMeta>;
  onAreaClick: (meta: BoundaryFeatureMeta, selectable: boolean) => void;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    const styleFor = (code: string, selectable: boolean): L.PathOptions => {
      const isSelected = selectedCode === code;
      const areaValue = valueByCode.get(code) ?? minValue;
      const color = intensityMode ? intensityColor(areaValue, minValue, maxValue) : colors.stroke;
      const fillColor = intensityMode ? color : colors.fill;

      return {
        color: isSelected ? "#f8fafc" : color,
        weight: isSelected ? 2.6 : intensityMode ? 2 : 1.45,
        fillColor,
        fillOpacity: intensityMode ? (isSelected ? 0.32 : selectable ? 0.22 : 0.1) : isSelected ? 0.22 : selectable ? 0.14 : 0.06,
        dashArray: selectable ? undefined : "4 4"
      };
    };

    if (!layerRef.current) {
      layerRef.current = L.geoJSON(undefined, { pane: "boundary-pane" }).addTo(map);
    }

    const layer = layerRef.current;
    layer.clearLayers();
    layer.addData(collection as any);

    layer.eachLayer((child) => {
      const layerWithFeature = child as L.Layer & { feature?: GeoFeature };
      const feature = layerWithFeature.feature;

      if (!feature) {
        return;
      }

      const code = featureCode(feature, level);
      const selectable = isSelectable(code);
      const meta = metaByCode.get(code);

      const pathLayer = child as L.Path;
      pathLayer.setStyle(styleFor(code, selectable));
      pathLayer.off("click");
      pathLayer.unbindTooltip();

      if (meta) {
        const stats = statsByCode.get(code);
        const tooltipLabel = displayLabel(meta, locale);
        const totalListings = formatNumber(stats?.totalListings ?? 0, locale);

        pathLayer.bindTooltip(`${tooltipLabel}<br/>${messages.kpi.total_listings}: ${totalListings}`, {
          sticky: true,
          direction: "center",
          opacity: 0.95
        });
      }

      if (selectable && meta) {
        pathLayer.on("click", () => onAreaClick(meta, true));
      }
    });
  }, [
    collection,
    colors.fill,
    colors.stroke,
    intensityMode,
    isSelectable,
    level,
    locale,
    map,
    maxValue,
    messages.kpi.total_listings,
    metaByCode,
    minValue,
    onAreaClick,
    selectedCode,
    statsByCode,
    valueByCode
  ]);

  useEffect(() => {
    return () => {
      layerRef.current?.remove();
      layerRef.current = null;
    };
  }, []);

  return null;
}

function BoundaryLayer({
  level,
  locale,
  messages,
  selectedCode,
  statsByCode,
  intensityMode,
  visibleMeta,
  onAreaClick
}: {
  level: MapLevel;
  locale: Locale;
  messages: LocaleMessages;
  selectedCode?: string;
  statsByCode: Map<string, AreaStats>;
  intensityMode: boolean;
  visibleMeta: BoundaryFeatureMeta[];
  onAreaClick: (meta: BoundaryFeatureMeta, selectable: boolean) => void;
}) {
  const colors = LEVEL_COLORS[level];

  const metaByCode = useMemo(() => {
    const map = new Map<string, BoundaryFeatureMeta>();

    for (const meta of visibleMeta) {
      map.set(meta.code, meta);
    }

    return map;
  }, [visibleMeta]);

  const collection = useMemo<GeoFeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: visibleMeta.map((meta) => meta.feature)
    }),
    [visibleMeta]
  );

  const isSelectable = useCallback(
    (code: string) => {
      if (level !== "district") {
        return true;
      }

      return (statsByCode.get(code)?.totalListings ?? 0) > 0;
    },
    [level, statsByCode]
  );

  const valueByCode = useMemo(() => {
    const values = new Map<string, number>();

    for (const meta of visibleMeta) {
      values.set(meta.code, statsByCode.get(meta.code)?.medianPricePerM2 ?? 0);
    }

    return values;
  }, [statsByCode, visibleMeta]);

  const [minValue, maxValue] = useMemo(() => {
    const values = Array.from(valueByCode.values());

    if (values.length === 0) {
      return [0, 0] as const;
    }

    return [Math.min(...values), Math.max(...values)] as const;
  }, [valueByCode]);

  return (
    <>
      <BoundaryGeoJsonLayer
        collection={collection}
        level={level}
        selectedCode={selectedCode}
        colors={colors}
        intensityMode={intensityMode}
        valueByCode={valueByCode}
        minValue={minValue}
        maxValue={maxValue}
        locale={locale}
        messages={messages}
        statsByCode={statsByCode}
        isSelectable={isSelectable}
        metaByCode={metaByCode}
        onAreaClick={onAreaClick}
      />

      {visibleMeta.map((meta) => {
        const stats = statsByCode.get(meta.code);

        const selectable = isSelectable(meta.code);

        return (
          <CircleMarker
            key={`${level}-dot-${meta.code}`}
            center={meta.center}
            radius={5}
            pane="boundary-dot-pane"
            pathOptions={{
              color: "#f8fafc",
              fillColor: colors.stroke,
              fillOpacity: selectable ? 0.95 : 0.5,
              weight: 1.1,
              dashArray: selectable ? undefined : "2 3"
            }}
            eventHandlers={{
              click: () => {
                if (!selectable) {
                  return;
                }

                onAreaClick(meta, true);
              }
            }}
          >
            <Tooltip direction="top" opacity={0.95}>
              <div className="space-y-1 text-xs">
                <p className="font-semibold">{displayLabel(meta, locale)}</p>
                <p>
                  {messages.kpi.total_listings}: {formatNumber(stats?.totalListings ?? 0, locale)}
                </p>
                <p className="inline-flex items-center gap-1">
                  <span>{messages.kpi.median_price}:</span>
                  <CurrencyValue value={stats?.medianPrice ?? 0} locale={locale} />
                </p>
                <p className="inline-flex items-center gap-1">
                  <span>{messages.kpi.median_price_per_m2}:</span>
                  <CurrencyValue value={stats?.medianPricePerM2 ?? 0} locale={locale} />
                  <span>/ m²</span>
                </p>
                {!selectable ? (
                  <p className="text-[11px] text-muted-foreground">{messages.map.no_listings_area}</p>
                ) : null}
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </>
  );
}

export function ListingsMap({
  locale,
  messages,
  filters,
  listings,
  overlayMode,
  mode,
  recenterSignal,
  onPatchFilters,
  onSelectListing,
  onViewportChange,
  onHierarchyChange,
  className
}: Props) {
  const router = useRouter();
  const mapRef = useRef<L.Map | null>(null);
  const unmountingRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const skipNextFilterAutoFitRef = useRef(false);
  const mapSelectionPatchRef = useRef(false);
  const lastGestureAtRef = useRef<number>(0);
  const previousDisplayLevelRef = useRef<MapLevel>("region");
  const appliedRecenterSignalRef = useRef<number | undefined>(undefined);
  const previousFilterKeyRef = useRef<string | null>(null);

  const [mapBounds, setMapBounds] = useState<MapBounds>();
  const [zoom, setZoom] = useState(6);
  const [selectionLockedByClick, setSelectionLockedByClick] = useState(false);
  const [displayLevel, setDisplayLevel] = useState<MapLevel>("region");
  const isAnalyzeMode = mode === "analyze";

  const [regionsGeoJson, setRegionsGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [citiesGeoJson, setCitiesGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [districtsGeoJson, setDistrictsGeoJson] = useState<GeoFeatureCollection | null>(null);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [loadingCity, setLoadingCity] = useState(false);
  const [loadingDistrict, setLoadingDistrict] = useState(false);
  const [boundaryError, setBoundaryError] = useState<string | null>(null);

  const selectionPath = useMemo(
    () => deriveSelectionPath(filters, selectionLockedByClick),
    [filters, selectionLockedByClick]
  );

  const center = useMemo<[number, number]>(() => {
    if (listings.length === 0) {
      return [24.7136, 46.6753];
    }

    const lat = listings.reduce((sum, item) => sum + item.latitude, 0) / listings.length;
    const lng = listings.reduce((sum, item) => sum + item.longitude, 0) / listings.length;

    return [lat, lng];
  }, [listings]);

  const regionIndex = useMemo<BoundaryIndex | null>(
    () => (regionsGeoJson ? buildBoundaryIndex("region", regionsGeoJson) : null),
    [regionsGeoJson]
  );

  const cityIndex = useMemo<BoundaryIndex | null>(
    () => (citiesGeoJson ? buildBoundaryIndex("city", citiesGeoJson) : null),
    [citiesGeoJson]
  );

  const districtIndex = useMemo<BoundaryIndex | null>(
    () => (districtsGeoJson ? buildBoundaryIndex("district", districtsGeoJson) : null),
    [districtsGeoJson]
  );

  const boundaryMetaLookup = useMemo<BoundaryMetaLookup>(
    () => ({
      regionByCode: regionIndex?.byCode ?? new Map<string, BoundaryFeatureMeta>(),
      cityByCode: cityIndex?.byCode ?? new Map<string, BoundaryFeatureMeta>(),
      districtByCode: districtIndex?.byCode ?? new Map<string, BoundaryFeatureMeta>()
    }),
    [cityIndex?.byCode, districtIndex?.byCode, regionIndex?.byCode]
  );

  const effectiveDisplayLevel = useMemo<MapLevel>(() => {
    if (displayLevel === "district") {
      const districtSource = districtIndex?.all ?? [];
      const districtMatches = selectionPath.cityCode
        ? districtSource.filter((meta) => meta.cityCode === selectionPath.cityCode)
        : [];

      if (districtMatches.length === 0) {
        return "city";
      }
    }

    if (displayLevel === "city") {
      const citySource = cityIndex?.all ?? [];
      const cityMatches = selectionPath.regionCode
        ? citySource.filter((meta) => meta.regionCode === selectionPath.regionCode)
        : citySource;

      if (cityMatches.length === 0) {
        return "region";
      }
    }

    return displayLevel;
  }, [cityIndex?.all, displayLevel, districtIndex?.all, selectionPath.cityCode, selectionPath.regionCode]);

  const visibleBoundaryMeta = useMemo(() => {
    if (effectiveDisplayLevel === "region") {
      return regionIndex?.all ?? [];
    }

    if (effectiveDisplayLevel === "city") {
      const source = cityIndex?.all ?? [];

      if (!selectionPath.regionCode) {
        return source;
      }

      const filtered = source.filter((meta) => meta.regionCode === selectionPath.regionCode);

      return filtered.length > 0 ? filtered : source;
    }

    if (!selectionPath.cityCode) {
      return [];
    }

    return (districtIndex?.all ?? []).filter((meta) => meta.cityCode === selectionPath.cityCode);
  }, [cityIndex?.all, districtIndex?.all, effectiveDisplayLevel, regionIndex?.all, selectionPath.cityCode, selectionPath.regionCode]);

  const statsByCode = useMemo(() => statsByCodeForLevel(effectiveDisplayLevel, listings), [effectiveDisplayLevel, listings]);

  const selectedCode =
    effectiveDisplayLevel === "region"
      ? selectionPath.regionCode
      : effectiveDisplayLevel === "city"
        ? selectionPath.cityCode
        : selectionPath.districtCode;
  const showListingLayer = !isAnalyzeMode && effectiveDisplayLevel === "district";

  const selectableBoundaryCount = useMemo(() => {
    if (effectiveDisplayLevel !== "district") {
      return visibleBoundaryMeta.length;
    }

    return visibleBoundaryMeta.filter((meta) => (statsByCode.get(meta.code)?.totalListings ?? 0) > 0).length;
  }, [effectiveDisplayLevel, statsByCode, visibleBoundaryMeta]);

  const listingById = useMemo(() => {
    const map = new Map<string, Listing>();

    for (const listing of listings) {
      map.set(listing.id, listing);
    }

    return map;
  }, [listings]);

  const points = useMemo<Supercluster.PointFeature<PointProperties>[]>(
    () =>
      listings.map((listing) => ({
        type: "Feature",
        properties: {
          listingId: listing.id
        },
        geometry: {
          type: "Point",
          coordinates: [listing.longitude, listing.latitude]
        }
      })),
    [listings]
  );

  const clusterIndex = useMemo(() => {
    const index = new Supercluster<PointProperties, Supercluster.AnyProps>({
      radius: 64,
      maxZoom: 16,
      minZoom: 2
    });

    index.load(points);

    return index;
  }, [points]);

  const clusterFeatures = useMemo(() => {
    const bbox: [number, number, number, number] = mapBounds
      ? [mapBounds.west, mapBounds.south, mapBounds.east, mapBounds.north]
      : [-180, -85, 180, 85];

    return clusterIndex.getClusters(bbox, Math.round(zoom));
  }, [clusterIndex, mapBounds, zoom]);

  const pricePerM2Values = listings
    .map((item) => item.price_per_m2)
    .filter((item): item is number => typeof item === "number");

  const minPPM2 = pricePerM2Values.length > 0 ? Math.min(...pricePerM2Values) : 0;
  const maxPPM2 = pricePerM2Values.length > 0 ? Math.max(...pricePerM2Values) : 0;

  const boundaryLoading = loadingRegion || loadingCity || loadingDistrict;

  const filterKey = useMemo(
    () =>
      [
        filters.goal,
        filters.rent_frequency.join(","),
        filters.property_type.join(","),
        filters.listing_type,
        filters.region.join(","),
        filters.city.join(","),
        filters.district.join(","),
        filters.price_min ?? "",
        filters.price_max ?? "",
        filters.area_min ?? "",
        filters.area_max ?? "",
        filters.bedrooms_min ?? "",
        filters.bathrooms_min ?? "",
        filters.rooms_min ?? "",
        filters.in_view ? "1" : "0",
        listings.map((item) => item.id).join(",")
      ].join("|"),
    [
      filters.area_max,
      filters.area_min,
      filters.bathrooms_min,
      filters.bedrooms_min,
      filters.city,
      filters.district,
      filters.goal,
      filters.in_view,
      filters.listing_type,
      filters.price_max,
      filters.price_min,
      filters.property_type,
      filters.region,
      filters.rent_frequency,
      filters.rooms_min,
      listings
    ]
  );

  const runCameraToTarget = useCallback(
    (_intent: MapCameraIntent, target: MapFitTarget | null) => {
      const map = mapRef.current;

      if (!map || unmountingRef.current || !target) {
        return;
      }

      map.stop();

      if (target.kind === "bounds") {
        const bounds = mapBoundsToLatLngBounds(target.bounds);
        if (!bounds.isValid()) {
          return;
        }

        map.flyToBounds(bounds.pad(MAP_UX_CONFIG.fitPaddingRatio), {
          animate: true,
          duration: MAP_UX_CONFIG.fitDurationSeconds
        });

        return;
      }

      map.flyTo(target.center, target.zoom, {
        animate: true,
        duration: MAP_UX_CONFIG.fitDurationSeconds
      });
    },
    []
  );

  const patchFiltersFromMap = useCallback(
    (patch: Partial<ListingFilters>, lockedByClick = true) => {
      mapSelectionPatchRef.current = true;
      skipNextFilterAutoFitRef.current = true;
      setSelectionLockedByClick(lockedByClick);
      onPatchFilters(patch);
    },
    [onPatchFilters]
  );

  const handleBoundarySelection = useCallback(
    (meta: BoundaryFeatureMeta, selectable: boolean) => {
      const nextPath = nextSelectionPathOnClick(
        effectiveDisplayLevel,
        meta.code,
        selectionPath,
        selectable,
        {
          regionCode: meta.regionCode,
          cityCode: meta.cityCode
        }
      );

      patchFiltersFromMap(pathToFilterPatch(nextPath), nextPath.lockedByClick);

      const target = computeFitTarget(nextPath, boundaryMetaLookup, listings);
      runCameraToTarget("boundary_click", target);
    },
    [boundaryMetaLookup, effectiveDisplayLevel, listings, patchFiltersFromMap, runCameraToTarget, selectionPath]
  );

  const handleMapStateChange = useCallback(
    (payload: MapStatePayload) => {
      setMapBounds((current) => (sameBounds(current, payload.bounds) ? current : payload.bounds));
      setZoom((current) => (current === payload.zoom ? current : payload.zoom));
      onViewportChange?.(payload.bounds);
    },
    [onViewportChange]
  );

  const handleMapReady = useCallback((map: L.Map | null) => {
    mapRef.current = map;
  }, []);

  const handleClusterMove = useCallback(
    (clusterCenter: [number, number], clusterZoom: number) => {
      runCameraToTarget("cluster_click", {
        kind: "center",
        center: clusterCenter,
        zoom: clusterZoom
      });
    },
    [runCameraToTarget]
  );

  const handleGestureStart = useCallback(() => {
    lastGestureAtRef.current = Date.now();
  }, []);

  const fetchBoundaryCollection = useCallback(async (url: string, signal: AbortSignal): Promise<GeoFeatureCollection> => {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Failed to load ${url}`);
    }

    const data = (await response.json()) as GeoFeatureCollection;
    return normalizeBoundaryCollection(data);
  }, []);

  useEffect(() => {
    if (regionsGeoJson) {
      return;
    }

    const controller = new AbortController();
    setLoadingRegion(true);
    setBoundaryError(null);

    void fetchBoundaryCollection("/geojson/regions.geojson", controller.signal)
      .then((collection) => {
        if (!controller.signal.aborted) {
          setRegionsGeoJson(collection);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBoundaryError(error instanceof Error ? error.message : "Failed to load boundaries");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRegion(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [fetchBoundaryCollection, regionsGeoJson]);

  useEffect(() => {
    if (citiesGeoJson) {
      return;
    }

    const controller = new AbortController();
    setLoadingCity(true);
    setBoundaryError(null);

    void fetchBoundaryCollection("/geojson/cities_polygons.geojson", controller.signal)
      .then((collection) => {
        if (!controller.signal.aborted) {
          setCitiesGeoJson(collection);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBoundaryError(error instanceof Error ? error.message : "Failed to load boundaries");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingCity(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [citiesGeoJson, fetchBoundaryCollection]);

  useEffect(() => {
    const shouldLoadDistricts = Boolean(selectionPath.cityCode || displayLevel === "district");

    if (districtsGeoJson || !shouldLoadDistricts) {
      return;
    }

    const controller = new AbortController();
    setLoadingDistrict(true);
    setBoundaryError(null);

    void fetchBoundaryCollection("/geojson/districts.geojson", controller.signal)
      .then((collection) => {
        if (!controller.signal.aborted) {
          setDistrictsGeoJson(collection);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setBoundaryError(error instanceof Error ? error.message : "Failed to load boundaries");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingDistrict(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    displayLevel,
    districtsGeoJson,
    fetchBoundaryCollection,
    selectionPath.cityCode
  ]);

  useEffect(() => {
    if (!boundaryError) {
      return;
    }

    const hasAnyBoundaryLoaded = Boolean(regionsGeoJson || citiesGeoJson || districtsGeoJson);
    if (hasAnyBoundaryLoaded) {
      setBoundaryError(null);
    }
  }, [boundaryError, citiesGeoJson, districtsGeoJson, regionsGeoJson]);

  useEffect(() => {
    if (mapSelectionPatchRef.current) {
      mapSelectionPatchRef.current = false;
      return;
    }

    setSelectionLockedByClick(false);
  }, [filters.city, filters.district, filters.region]);

  useEffect(() => {
    setDisplayLevel((current) => resolveDisplayLevel(zoom, selectionPath, current));
  }, [selectionPath, zoom]);

  useEffect(() => {
    const previous = previousDisplayLevelRef.current;
    previousDisplayLevelRef.current = displayLevel;

    const recentlyGestureDriven = Date.now() - lastGestureAtRef.current < 1200;

    if (!selectionPath.lockedByClick || !recentlyGestureDriven) {
      return;
    }

    if (previous === "district" && displayLevel === "city" && selectionPath.districtCode) {
      patchFiltersFromMap({ district: [] });
      return;
    }

    if (previous === "city" && displayLevel === "region" && (selectionPath.cityCode || selectionPath.districtCode)) {
      patchFiltersFromMap({ city: [], district: [] });
    }
  }, [displayLevel, patchFiltersFromMap, selectionPath.cityCode, selectionPath.districtCode, selectionPath.lockedByClick]);

  useEffect(() => {
    if (initialFitDoneRef.current || !mapRef.current) {
      return;
    }

    const requiredBoundaryReady =
      (selectionPath.districtCode ? boundaryMetaLookup.districtByCode.size > 0 : true) &&
      (selectionPath.cityCode ? boundaryMetaLookup.cityByCode.size > 0 : true) &&
      (selectionPath.regionCode ? boundaryMetaLookup.regionByCode.size > 0 : true);

    if (!requiredBoundaryReady) {
      return;
    }

    const target = computeFitTarget(selectionPath, boundaryMetaLookup, listings);

    if (
      shouldAutoFit(
        "initial",
        {
          inView: filters.in_view,
          visibleRatio: computeVisibleRatio(listings, mapBounds),
          hasMapBounds: Boolean(mapBounds)
        },
        MAP_UX_CONFIG
      )
    ) {
      runCameraToTarget("initial", target);
    }

    initialFitDoneRef.current = true;
  }, [boundaryMetaLookup, filters.in_view, listings, mapBounds, runCameraToTarget, selectionPath]);

  useEffect(() => {
    if (!mapRef.current || !initialFitDoneRef.current) {
      previousFilterKeyRef.current = filterKey;
      return;
    }

    if (!previousFilterKeyRef.current) {
      previousFilterKeyRef.current = filterKey;
      return;
    }

    if (previousFilterKeyRef.current === filterKey) {
      return;
    }

    previousFilterKeyRef.current = filterKey;

    if (skipNextFilterAutoFitRef.current) {
      skipNextFilterAutoFitRef.current = false;
      return;
    }

    const visibleRatio = computeVisibleRatio(listings, mapBounds);

    if (
      !shouldAutoFit(
        "filter_change",
        {
          inView: filters.in_view,
          visibleRatio,
          hasMapBounds: Boolean(mapBounds)
        },
        MAP_UX_CONFIG
      )
    ) {
      return;
    }

    const target = computeFitTarget(selectionPath, boundaryMetaLookup, listings);
    runCameraToTarget("filter_change", target);
  }, [boundaryMetaLookup, filterKey, filters.in_view, listings, mapBounds, runCameraToTarget, selectionPath]);

  useEffect(() => {
    if (typeof recenterSignal !== "number" || appliedRecenterSignalRef.current === recenterSignal) {
      return;
    }

    appliedRecenterSignalRef.current = recenterSignal;

    const target = computeFitTarget(selectionPath, boundaryMetaLookup, listings);
    runCameraToTarget("recenter", target);
  }, [boundaryMetaLookup, listings, recenterSignal, runCameraToTarget, selectionPath]);

  useEffect(() => {
    onHierarchyChange?.({
      level: effectiveDisplayLevel,
      regionCode: selectionPath.regionCode,
      cityCode: selectionPath.cityCode,
      districtCode: selectionPath.districtCode,
      boundaryCount: visibleBoundaryMeta.length,
      selectableCount: selectableBoundaryCount
    });
  }, [
    effectiveDisplayLevel,
    onHierarchyChange,
    selectableBoundaryCount,
    selectionPath.cityCode,
    selectionPath.districtCode,
    selectionPath.regionCode,
    visibleBoundaryMeta.length
  ]);

  useEffect(() => {
    const handleRouteChange = () => {
      const map = mapRef.current;
      if (map) {
        map.stop();
      }
    };

    router.events.on("routeChangeStart", handleRouteChange);

    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events]);

  useEffect(() => {
    return () => {
      unmountingRef.current = true;
      mapRef.current?.stop();
    };
  }, []);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div className="pointer-events-none absolute start-3 top-3 z-[1000] rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
        {messages.map.map_hint}
      </div>
      {boundaryLoading ? (
        <div className="pointer-events-none absolute start-3 top-11 z-[1000] rounded-md border border-border/70 bg-background/85 px-2 py-1 text-[11px] text-muted-foreground backdrop-blur">
          Loading boundaries...
        </div>
      ) : null}
      {boundaryError ? (
        <div className="pointer-events-none absolute start-3 top-11 z-[1000] rounded-md border border-destructive/60 bg-background/85 px-2 py-1 text-[11px] text-destructive backdrop-blur">
          {boundaryError}
        </div>
      ) : null}

      <MapContainer
        center={center}
        zoom={6}
        zoomSnap={0.5}
        zoomDelta={1}
        wheelPxPerZoomLevel={30}
        wheelDebounceTime={20}
        className="h-[58vh] min-h-[420px] w-full rounded-xl border border-border/70 bg-slate-950"
      >
        <Pane name="boundary-pane" style={{ zIndex: 320 }} />
        <Pane name="boundary-dot-pane" style={{ zIndex: 420 }} />
        <Pane name="cluster-pane" style={{ zIndex: 520 }} />
        <Pane name="listing-pane" style={{ zIndex: 560 }} />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          keepBuffer={12}
          updateWhenZooming
        />

        <MapStateBridge
          onMapReady={handleMapReady}
          onStateChange={handleMapStateChange}
          onGestureStart={handleGestureStart}
        />

        {visibleBoundaryMeta.length > 0 ? (
        <BoundaryLayer
          level={effectiveDisplayLevel}
          locale={locale}
          messages={messages}
          selectedCode={selectedCode}
          statsByCode={statsByCode}
          intensityMode={isAnalyzeMode && overlayMode === "intensity"}
          visibleMeta={visibleBoundaryMeta}
          onAreaClick={handleBoundarySelection}
        />
      ) : null}

        {showListingLayer ? (
          overlayMode === "markers" ? (
            <ClusterLayer
              clusterFeatures={clusterFeatures}
              clusterIndex={clusterIndex}
              listingById={listingById}
              locale={locale}
              messages={messages}
              onSelectListing={onSelectListing}
              onClusterMove={handleClusterMove}
            />
          ) : (
            <>
              {listings.map((item) => {
                const ppm2 = item.price_per_m2 ?? 0;
                const color = intensityColor(ppm2, minPPM2, maxPPM2);
                const radius = 6 + ((ppm2 - minPPM2) / Math.max(1, maxPPM2 - minPPM2)) * 12;

                return (
                  <CircleMarker
                    key={item.id}
                    center={[item.latitude, item.longitude]}
                    pane="listing-pane"
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.55,
                      weight: 1
                    }}
                    radius={Number.isFinite(radius) ? radius : 6}
                    eventHandlers={{
                      click: () => onSelectListing(item)
                    }}
                  >
                    <Popup>
                      <div className="space-y-1 text-xs">
                        <p className="font-semibold">
                          <CurrencyValue value={item.price} locale={locale} />
                        </p>
                        <p>
                          {getCityLabel(item.city_code, locale)} · {getDistrictLabel(item.district_code, locale)}
                        </p>
                        <p>
                          {messages.listings.price_per_m2}:{" "}
                          {item.price_per_m2
                            ? (
                              <span className="inline-flex items-center gap-1">
                                <CurrencyValue value={item.price_per_m2} locale={locale} />
                                <span>/ m²</span>
                              </span>
                              )
                            : messages.common.not_available}
                        </p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </>
          )
        ) : null}
      </MapContainer>
    </div>
  );
}
