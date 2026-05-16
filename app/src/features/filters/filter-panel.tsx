import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Building2, Filter, KeyRound, Landmark, Home } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { defaultFilters, normalizeFilters, withResetPage } from "@/lib/realestate/pipeline";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiCombobox, type MultiComboboxOption } from "@/components/ui/multi-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
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
  disableNumericFilters?: boolean;
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
  if (selectedCities.length === 0) {
    return [];
  }

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

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function areFiltersEqual(left: ListingFilters, right: ListingFilters): boolean {
  return (
    left.goal === right.goal &&
    left.listing_type === right.listing_type &&
    left.sort === right.sort &&
    left.page === right.page &&
    left.in_view === right.in_view &&
    left.price_min === right.price_min &&
    left.price_max === right.price_max &&
    left.area_min === right.area_min &&
    left.area_max === right.area_max &&
    left.bedrooms_min === right.bedrooms_min &&
    left.bathrooms_min === right.bathrooms_min &&
    left.rooms_min === right.rooms_min &&
    areStringArraysEqual(left.rent_frequency, right.rent_frequency) &&
    areStringArraysEqual(left.property_type, right.property_type) &&
    areStringArraysEqual(left.region, right.region) &&
    areStringArraysEqual(left.city, right.city) &&
    areStringArraysEqual(left.district, right.district)
  );
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
      className="grid gap-1.5"
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
              "group flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border/70 bg-surface-3/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
            )}
            onClick={() => onChange(option.value)}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span>{option.label}</span>
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
  disableNumericFilters = false,
  compact = false
}: FilterPanelProps) {
  const normalizedFilters = useMemo(() => normalizeFilters(filters), [filters]);
  const [draftFilters, setDraftFilters] = useState<ListingFilters>(() => normalizedFilters);

  useEffect(() => {
    setDraftFilters(normalizedFilters);
  }, [normalizedFilters]);

  const visibleCities = getVisibleCityOptions(options, draftFilters.region);
  const visibleDistricts = getVisibleDistrictOptions(options, draftFilters.region, draftFilters.city);
  const hasPendingChanges = useMemo(
    () => !areFiltersEqual(draftFilters, normalizedFilters),
    [draftFilters, normalizedFilters]
  );

  const regionOptions: MultiComboboxOption[] = useMemo(
    () =>
      options.region.map((code) => ({
        value: code,
        label: getRegionLabel(code, locale)
      })),
    [options.region, locale]
  );

  const cityOptions: MultiComboboxOption[] = useMemo(
    () =>
      visibleCities.map((code) => ({
        value: code,
        label: getCityLabel(code, locale)
      })),
    [visibleCities, locale]
  );

  const districtOptions: MultiComboboxOption[] = useMemo(
    () =>
      visibleDistricts.map((code) => ({
        value: code,
        label: getDistrictLabel(code, locale)
      })),
    [visibleDistricts, locale]
  );

  const propertyTypeChips = options.property_type;

  const patchDraft = (
    patch: Partial<ListingFilters>,
    patchOptions: PatchOptions = { resetPage: true }
  ) => {
    setDraftFilters((current) => {
      const next = normalizeFilters({
        ...current,
        ...patch
      });

      return patchOptions.resetPage === false ? next : withResetPage(next);
    });
  };

  const onRegionChange = (nextRegion: string[]) => {
    const nextVisibleCitySet = new Set(getVisibleCityOptions(options, nextRegion));
    const nextCity = draftFilters.city.filter((cityCode) => nextVisibleCitySet.has(cityCode));
    const nextVisibleDistrictSet = new Set(getVisibleDistrictOptions(options, nextRegion, nextCity));
    const nextDistrict = draftFilters.district.filter((districtCode) =>
      nextVisibleDistrictSet.has(districtCode)
    );

    patchDraft({
      region: nextRegion as ListingFilters["region"],
      city: nextCity as ListingFilters["city"],
      district: nextDistrict as ListingFilters["district"]
    });
  };

  const onCityChange = (nextCity: string[]) => {
    const nextVisibleDistrictSet = new Set(
      getVisibleDistrictOptions(options, draftFilters.region, nextCity)
    );
    const nextDistrict = draftFilters.district.filter((districtCode) =>
      nextVisibleDistrictSet.has(districtCode)
    );

    patchDraft({
      city: nextCity as ListingFilters["city"],
      district: nextDistrict as ListingFilters["district"]
    });
  };

  const onDistrictChange = (nextDistrict: string[]) => {
    patchDraft({ district: nextDistrict as ListingFilters["district"] });
  };

  const onApply = () => {
    onPatch(draftFilters, { resetPage: false });
  };

  const onClearAll = () => {
    setDraftFilters(defaultFilters);
    onReset();
  };

  const pad = compact ? "p-4" : "p-4 lg:p-5";

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-surface-2">
      <div className={cn("flex items-center justify-between border-b border-border/60", pad)}>
        <p className="text-sm font-semibold tracking-tight text-foreground">
          {messages.filters.title}
        </p>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearAll}>
          {messages.filters.clear_all}
        </Button>
      </div>
      <div className={cn("space-y-4", pad)}>
        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.goal}
          </Label>
          <IconRadioToggle
            value={draftFilters.goal}
            onChange={(value) => patchDraft({ goal: value, rent_frequency: [] })}
            options={[
              { value: "sale", label: messages.goal.sale, icon: Landmark },
              { value: "rent", label: messages.goal.rent, icon: KeyRound }
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.listing_type}
          </Label>
          <IconRadioToggle
            value={draftFilters.listing_type}
            onChange={(value) => patchDraft({ listing_type: value })}
            options={[
              { value: "residential", label: messages.listing_type.residential, icon: Home },
              { value: "commercial", label: messages.listing_type.commercial, icon: Building2 }
            ]}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.region}
          </Label>
          <MultiCombobox
            options={regionOptions}
            values={draftFilters.region}
            onChange={onRegionChange}
            placeholder={messages.filters.region_placeholder}
            searchPlaceholder={messages.filters.search_placeholder}
            emptyText={messages.filters.no_matches}
            clearLabel={messages.filters.clear_all}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.city}
          </Label>
          <MultiCombobox
            options={cityOptions}
            values={draftFilters.city}
            onChange={onCityChange}
            placeholder={messages.filters.city_placeholder}
            searchPlaceholder={messages.filters.search_placeholder}
            emptyText={messages.filters.no_matches}
            clearLabel={messages.filters.clear_all}
          />
        </div>

        {draftFilters.city.length > 0 ? (
          <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.district}
            </Label>
            <MultiCombobox
              options={districtOptions}
              values={draftFilters.district}
              onChange={onDistrictChange}
              placeholder={messages.filters.district_placeholder}
              searchPlaceholder={messages.filters.search_placeholder}
              emptyText={messages.filters.no_matches}
              clearLabel={messages.filters.clear_all}
            />
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.property_type}
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {propertyTypeChips.map((type) => {
              const isActive = draftFilters.property_type.includes(type);
              return (
                <button
                  type="button"
                  key={type}
                  onClick={() =>
                    patchDraft({
                      property_type: toggleString(
                        draftFilters.property_type,
                        type
                      ) as ListingFilters["property_type"]
                    })
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border/70 bg-surface-3/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                  aria-pressed={isActive}
                >
                  {messages.property_type[type]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="price_min" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.price_min}
            </Label>
            <Input
              id="price_min"
              inputMode="numeric"
              className="num"
              value={draftFilters.price_min ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ price_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="price_max" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.price_max}
            </Label>
            <Input
              id="price_max"
              inputMode="numeric"
              className="num"
              value={draftFilters.price_max ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ price_max: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="area_min" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.area_min}
            </Label>
            <Input
              id="area_min"
              inputMode="numeric"
              className="num"
              value={draftFilters.area_min ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ area_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="area_max" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.area_max}
            </Label>
            <Input
              id="area_max"
              inputMode="numeric"
              className="num"
              value={draftFilters.area_max ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ area_max: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1.5">
            <Label htmlFor="bedrooms_min" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.bedrooms_min}
            </Label>
            <Input
              id="bedrooms_min"
              inputMode="numeric"
              className="num"
              value={draftFilters.bedrooms_min ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ bedrooms_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bathrooms_min" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.bathrooms_min}
            </Label>
            <Input
              id="bathrooms_min"
              inputMode="numeric"
              className="num"
              value={draftFilters.bathrooms_min ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ bathrooms_min: parseNumber(event.target.value) })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rooms_min" className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {messages.filters.rooms_min}
            </Label>
            <Input
              id="rooms_min"
              inputMode="numeric"
              className="num"
              value={draftFilters.rooms_min ?? ""}
              disabled={disableNumericFilters}
              onChange={(event) => patchDraft({ rooms_min: parseNumber(event.target.value) })}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {messages.filters.sort}
          </Label>
          <Select
            value={draftFilters.sort}
            onValueChange={(value) => patchDraft({ sort: value as ListingSort })}
          >
            <SelectTrigger className="bg-surface-3/40">
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

        {showInViewToggle ? (
          <div className="flex items-center justify-between rounded-md border border-border/70 bg-surface-3/40 px-3 py-2">
            <Label htmlFor="in-view" className="text-xs text-muted-foreground">
              {messages.filters.in_view}
            </Label>
            <Switch
              id="in-view"
              checked={draftFilters.in_view}
              onCheckedChange={(checked) => patchDraft({ in_view: checked }, { resetPage: false })}
            />
          </div>
        ) : null}
      </div>

      <div className={cn("sticky bottom-0 border-t border-border/60 bg-surface-2/95 backdrop-blur", pad)}>
        <Button
          className="w-full"
          onClick={onApply}
          disabled={!hasPendingChanges}
        >
          {messages.filters.apply}
        </Button>
      </div>
    </div>
  );
}

export function FilterPanelDesktop(props: FilterPanelProps) {
  return <FilterPanelBody {...props} />;
}

export function FilterPanelMobile(props: FilterPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label={props.messages.filters.open_filters}
          title={props.messages.filters.open_filters}
        >
          <Filter className="h-4 w-4" />
          <span className="sr-only">{props.messages.filters.open_filters}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[92vw] overflow-y-auto border-border/70 bg-background p-0">
        <SheetHeader className="border-b border-border/70 p-4">
          <SheetTitle>{props.messages.filters.title}</SheetTitle>
        </SheetHeader>
        <div className="p-3">
          <FilterPanelBody {...props} compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
