import type { ComponentType } from "react";
import { Building2, Filter, KeyRound, Landmark, Home } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import type { FilterOptionSet, ListingFilters, ListingSort } from "@/lib/realestate/types";
import {
  getCityLabel,
  getCityRegionCode,
  getDistrictCityCode,
  getDistrictRegionCode,
  getDistrictLabel,
  getRegionLabel
} from "@/lib/location-codes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";

type PatchOptions = {
  resetPage?: boolean;
};

type FilterPanelProps = {
  locale: Locale;
  messages: LocaleMessages;
  filters: ListingFilters;
  options: FilterOptionSet;
  onPatch: (patch: Partial<ListingFilters>, options?: PatchOptions) => void;
  onReset: () => void;
  showInViewToggle?: boolean;
  compact?: boolean;
};

const sortOptions: Array<{ value: ListingSort; key: keyof LocaleMessages["sorting"] }> = [
  { value: "newest", key: "newest" },
  { value: "price_desc", key: "price_desc" },
  { value: "price_asc", key: "price_asc" },
  { value: "area_desc", key: "area_desc" },
  { value: "area_asc", key: "area_asc" },
  { value: "price_per_m2_desc", key: "price_per_m2_desc" },
  { value: "price_per_m2_asc", key: "price_per_m2_asc" },
  { value: "bedrooms_desc", key: "bedrooms_desc" }
];

function parseNumber(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function toggleString(items: string[], value: string): string[] {
  if (items.includes(value)) {
    return items.filter((item) => item !== value);
  }

  return [...items, value];
}

function getVisibleCityOptions(options: FilterOptionSet, selectedRegions: string[]): string[] {
  if (selectedRegions.length === 0) {
    return options.city;
  }

  const regionSet = new Set(selectedRegions);
  return options.city.filter((cityCode) => {
    const regionCode = getCityRegionCode(cityCode);
    return Boolean(regionCode && regionSet.has(regionCode));
  });
}

function getVisibleDistrictOptions(
  options: FilterOptionSet,
  selectedRegions: string[],
  selectedCities: string[]
): string[] {
  const regionSet = new Set(selectedRegions);
  const citySet = new Set(selectedCities);

  return options.district.filter((districtCode) => {
    const cityCode = getDistrictCityCode(districtCode);
    const regionCode = getDistrictRegionCode(districtCode);

    if (citySet.size > 0) {
      return Boolean(cityCode && citySet.has(cityCode));
    }

    if (regionSet.size > 0) {
      return Boolean(regionCode && regionSet.has(regionCode));
    }

    return true;
  });
}

type IconToggleOption<T extends string> = {
  value: T;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

type IconRadioToggleProps<T extends string> = {
  value: T;
  options: IconToggleOption<T>[];
  onChange: (value: T) => void;
};

function IconRadioToggle<T extends string>({ value, options, onChange }: IconRadioToggleProps<T>) {
  return (
    <div
      role="radiogroup"
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = value === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs transition-colors",
              isActive
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border/70 bg-background/50 text-muted-foreground hover:bg-secondary/60"
            )}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-4 w-4" />
            <span className="text-center leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function FilterPanelBody({
  locale,
  messages,
  filters,
  options,
  onPatch,
  onReset,
  showInViewToggle = false,
  compact = false
}: FilterPanelProps) {
  const visibleCities = getVisibleCityOptions(options, filters.region);
  const visibleDistricts = getVisibleDistrictOptions(options, filters.region, filters.city);

  const onRegionToggle = (regionCode: string) => {
    const nextRegion = toggleString(filters.region, regionCode);
    const nextVisibleCitySet = new Set(getVisibleCityOptions(options, nextRegion));
    const nextCity = filters.city.filter((cityCode) => nextVisibleCitySet.has(cityCode));
    const nextVisibleDistrictSet = new Set(
      getVisibleDistrictOptions(options, nextRegion, nextCity)
    );
    const nextDistrict = filters.district.filter((districtCode) =>
      nextVisibleDistrictSet.has(districtCode)
    );

    onPatch({
      region: nextRegion as ListingFilters["region"],
      city: nextCity as ListingFilters["city"],
      district: nextDistrict as ListingFilters["district"]
    });
  };

  const onCityToggle = (cityCode: string) => {
    const nextCity = toggleString(filters.city, cityCode);
    const nextVisibleDistrictSet = new Set(
      getVisibleDistrictOptions(options, filters.region, nextCity)
    );
    const nextDistrict = filters.district.filter((districtCode) =>
      nextVisibleDistrictSet.has(districtCode)
    );

    onPatch({
      city: nextCity as ListingFilters["city"],
      district: nextDistrict as ListingFilters["district"]
    });
  };

  return (
    <Card className="h-fit border-border/70 bg-card/90">
      <CardHeader className={compact ? "p-4" : "p-5"}>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{messages.filters.title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onReset}>
            {messages.filters.clear_all}
          </Button>
        </div>
      </CardHeader>
      <CardContent className={compact ? "space-y-4 p-4 pt-0" : "space-y-5 p-5 pt-0"}>
        <div className="space-y-2">
          <Label>{messages.filters.goal}</Label>
          <IconRadioToggle
            value={filters.goal}
            onChange={(value) =>
              onPatch(value === "rent" ? { goal: value } : { goal: value, rent_frequency: [] })
            }
            options={[
              { value: "sale", label: messages.goal.sale, icon: Landmark },
              { value: "rent", label: messages.goal.rent, icon: KeyRound }
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label>{messages.filters.listing_type}</Label>
          <IconRadioToggle
            value={filters.listing_type}
            onChange={(value) => onPatch({ listing_type: value })}
            options={[
              { value: "residential", label: messages.listing_type.residential, icon: Home },
              { value: "commercial", label: messages.listing_type.commercial, icon: Building2 }
            ]}
          />
        </div>

        <div className="space-y-2">
          <Label>{messages.filters.sort}</Label>
          <Select value={filters.sort} onValueChange={(value) => onPatch({ sort: value as ListingSort })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {messages.sorting[option.key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {filters.goal === "rent" ? (
          <div className="space-y-2">
            <Label>{messages.listings.rent_frequency}</Label>
            <div className="grid gap-2">
              {options.rent_frequency.map((frequency) => (
                <label key={frequency} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Checkbox
                    checked={filters.rent_frequency.includes(frequency)}
                    onCheckedChange={() =>
                      onPatch({
                        rent_frequency: toggleString(
                          filters.rent_frequency,
                          frequency
                        ) as ListingFilters["rent_frequency"]
                      })
                    }
                  />
                  <span>{messages.rent_frequency[frequency]}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label>{messages.filters.property_type}</Label>
          <div className="grid max-h-40 gap-2 overflow-y-auto pr-1">
            {options.property_type.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={filters.property_type.includes(type)}
                  onCheckedChange={() =>
                    onPatch({
                      property_type: toggleString(filters.property_type, type) as ListingFilters["property_type"]
                    })
                  }
                />
                <span>{messages.property_type[type]}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="price_min">{messages.filters.price_min}</Label>
            <Input
              id="price_min"
              inputMode="numeric"
              value={filters.price_min ?? ""}
              onChange={(event) => onPatch({ price_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="price_max">{messages.filters.price_max}</Label>
            <Input
              id="price_max"
              inputMode="numeric"
              value={filters.price_max ?? ""}
              onChange={(event) => onPatch({ price_max: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="area_min">{messages.filters.area_min}</Label>
            <Input
              id="area_min"
              inputMode="numeric"
              value={filters.area_min ?? ""}
              onChange={(event) => onPatch({ area_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="area_max">{messages.filters.area_max}</Label>
            <Input
              id="area_max"
              inputMode="numeric"
              value={filters.area_max ?? ""}
              onChange={(event) => onPatch({ area_max: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label htmlFor="bedrooms_min">{messages.filters.bedrooms_min}</Label>
            <Input
              id="bedrooms_min"
              inputMode="numeric"
              value={filters.bedrooms_min ?? ""}
              onChange={(event) => onPatch({ bedrooms_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bathrooms_min">{messages.filters.bathrooms_min}</Label>
            <Input
              id="bathrooms_min"
              inputMode="numeric"
              value={filters.bathrooms_min ?? ""}
              onChange={(event) => onPatch({ bathrooms_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rooms_min">{messages.filters.rooms_min}</Label>
            <Input
              id="rooms_min"
              inputMode="numeric"
              value={filters.rooms_min ?? ""}
              onChange={(event) => onPatch({ rooms_min: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>{messages.filters.region}</Label>
          <div className="grid max-h-32 gap-2 overflow-y-auto pr-1">
            {options.region.map((region) => (
              <label key={region} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={filters.region.includes(region)} onCheckedChange={() => onRegionToggle(region)} />
                <span>{getRegionLabel(region, locale)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{messages.filters.city}</Label>
          <div className="grid max-h-32 gap-2 overflow-y-auto pr-1">
            {visibleCities.map((city) => (
              <label key={city} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={filters.city.includes(city)}
                  onCheckedChange={() => onCityToggle(city)}
                />
                <span>{getCityLabel(city, locale)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{messages.filters.district}</Label>
          <div className="grid max-h-32 gap-2 overflow-y-auto pr-1">
            {visibleDistricts.map((district) => (
              <label key={district} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={filters.district.includes(district)}
                  onCheckedChange={() =>
                    onPatch({
                      district: toggleString(filters.district, district) as ListingFilters["district"]
                    })
                  }
                />
                <span>{getDistrictLabel(district, locale)}</span>
              </label>
            ))}
          </div>
        </div>

        {showInViewToggle ? (
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
            <Label htmlFor="in-view" className="text-sm text-muted-foreground">
              {messages.filters.in_view}
            </Label>
            <Switch
              id="in-view"
              checked={filters.in_view}
              onCheckedChange={(checked) => onPatch({ in_view: checked }, { resetPage: false })}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function FilterPanelDesktop(props: FilterPanelProps) {
  return <FilterPanelBody {...props} />;
}

export function FilterPanelMobile(props: FilterPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="w-full gap-2">
          <Filter className="h-4 w-4" />
          {props.messages.filters.open_filters}
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[92vw] overflow-y-auto border-border/70 bg-background p-0">
        <SheetHeader className="border-b border-border/70 p-4">
          <SheetTitle>{props.messages.filters.title}</SheetTitle>
        </SheetHeader>
        <div className="p-4">
          <FilterPanelBody {...props} compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
