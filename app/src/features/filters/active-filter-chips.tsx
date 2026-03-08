import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { getCityLabel, getDistrictLabel, getRegionLabel } from "@/lib/location-codes";
import { defaultFilters } from "@/lib/realestate/pipeline";
import type { ListingFilters } from "@/lib/realestate/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type PatchOptions = {
  resetPage?: boolean;
};

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  filters: ListingFilters;
  onPatch: (patch: Partial<ListingFilters>, options?: PatchOptions) => void;
  onReset: () => void;
};

type Chip = {
  id: string;
  label: string;
  onRemove: () => void;
};

export function ActiveFilterChips({ locale, messages, filters, onPatch, onReset }: Props) {
  const chips: Chip[] = [];

  if (filters.goal !== defaultFilters.goal) {
    chips.push({
      id: "goal",
      label: `${messages.filters.goal}: ${messages.goal[filters.goal]}`,
      onRemove: () => onPatch({ goal: defaultFilters.goal })
    });
  }

  for (const region of filters.region) {
    chips.push({
      id: `region-${region}`,
      label: `${messages.filters.region}: ${getRegionLabel(region, locale)}`,
      onRemove: () => onPatch({ region: filters.region.filter((item) => item !== region) })
    });
  }

  for (const city of filters.city) {
    chips.push({
      id: `city-${city}`,
      label: `${messages.filters.city}: ${getCityLabel(city, locale)}`,
      onRemove: () => onPatch({ city: filters.city.filter((item) => item !== city) })
    });
  }

  for (const district of filters.district) {
    chips.push({
      id: `district-${district}`,
      label: `${messages.filters.district}: ${getDistrictLabel(district, locale)}`,
      onRemove: () => onPatch({ district: filters.district.filter((item) => item !== district) })
    });
  }

  for (const propertyType of filters.property_type) {
    chips.push({
      id: `property-${propertyType}`,
      label: `${messages.filters.property_type}: ${messages.property_type[propertyType]}`,
      onRemove: () =>
        onPatch({
          property_type: filters.property_type.filter((item) => item !== propertyType)
        })
    });
  }

  if (filters.listing_type !== defaultFilters.listing_type) {
    chips.push({
      id: "listing_type",
      label: `${messages.filters.listing_type}: ${messages.listing_type[filters.listing_type]}`,
      onRemove: () => onPatch({ listing_type: defaultFilters.listing_type })
    });
  }

  if (typeof filters.price_min === "number") {
    chips.push({
      id: "price_min",
      label: `${messages.filters.price_min}: ${filters.price_min}`,
      onRemove: () => onPatch({ price_min: undefined })
    });
  }

  if (typeof filters.price_max === "number") {
    chips.push({
      id: "price_max",
      label: `${messages.filters.price_max}: ${filters.price_max}`,
      onRemove: () => onPatch({ price_max: undefined })
    });
  }

  if (typeof filters.area_min === "number") {
    chips.push({
      id: "area_min",
      label: `${messages.filters.area_min}: ${filters.area_min}`,
      onRemove: () => onPatch({ area_min: undefined })
    });
  }

  if (typeof filters.area_max === "number") {
    chips.push({
      id: "area_max",
      label: `${messages.filters.area_max}: ${filters.area_max}`,
      onRemove: () => onPatch({ area_max: undefined })
    });
  }

  if (typeof filters.bedrooms_min === "number") {
    chips.push({
      id: "bedrooms_min",
      label: `${messages.filters.bedrooms_min}: ${filters.bedrooms_min}`,
      onRemove: () => onPatch({ bedrooms_min: undefined })
    });
  }

  if (typeof filters.bathrooms_min === "number") {
    chips.push({
      id: "bathrooms_min",
      label: `${messages.filters.bathrooms_min}: ${filters.bathrooms_min}`,
      onRemove: () => onPatch({ bathrooms_min: undefined })
    });
  }

  if (typeof filters.rooms_min === "number") {
    chips.push({
      id: "rooms_min",
      label: `${messages.filters.rooms_min}: ${filters.rooms_min}`,
      onRemove: () => onPatch({ rooms_min: undefined })
    });
  }

  const hasSort = filters.sort !== defaultFilters.sort;
  if (hasSort) {
    chips.push({
      id: "sort",
      label: `${messages.filters.sort}: ${messages.sorting[filters.sort]}`,
      onRemove: () => onPatch({ sort: defaultFilters.sort })
    });
  }

  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {messages.filters.active_filters}
        </p>
        <Button variant="ghost" size="sm" onClick={onReset}>
          {messages.filters.clear_all}
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <Badge key={chip.id} variant="secondary" className="gap-1 rounded-full px-3 py-1 text-xs">
            {chip.label}
            <button
              type="button"
              className="inline-flex rounded-full p-0.5 transition-colors hover:bg-background/70"
              onClick={chip.onRemove}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
