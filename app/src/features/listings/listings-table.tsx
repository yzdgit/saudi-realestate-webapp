import { ArrowDown, ArrowUp, ArrowUpDown, Bath, BedDouble, MapPin } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { Listing, ListingSort } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyValue } from "@/components/ui/currency-value";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  listings: Listing[];
  compareIds: string[];
  sort?: ListingSort;
  onSelect: (listing: Listing) => void;
  onToggleCompare: (listing: Listing) => void;
  onSortChange?: (sort: ListingSort) => void;
};

type SortKey = "price" | "area" | "price_per_m2" | "bedrooms";

const ascSortByKey: Record<Exclude<SortKey, "bedrooms">, ListingSort> = {
  price: "price_asc",
  area: "area_asc",
  price_per_m2: "price_per_m2_asc"
};

const descSortByKey: Record<SortKey, ListingSort> = {
  price: "price_desc",
  area: "area_desc",
  price_per_m2: "price_per_m2_desc",
  bedrooms: "bedrooms_desc"
};

function sortDirectionFor(currentSort: ListingSort | undefined, key: SortKey): "asc" | "desc" | null {
  if (!currentSort) return null;
  if (key !== "bedrooms" && currentSort === ascSortByKey[key]) return "asc";
  if (currentSort === descSortByKey[key]) return "desc";
  return null;
}

function nextSortFor(currentSort: ListingSort | undefined, key: SortKey): ListingSort {
  const current = sortDirectionFor(currentSort, key);
  if (key === "bedrooms") {
    return current === "desc" ? "newest" : descSortByKey.bedrooms;
  }
  if (current === "desc") return ascSortByKey[key];
  if (current === "asc") return "newest";
  return descSortByKey[key];
}

function SortIndicator({ direction }: { direction: "asc" | "desc" | null }) {
  if (direction === "asc") {
    return <ArrowUp className="h-3 w-3 text-foreground" aria-hidden />;
  }
  if (direction === "desc") {
    return <ArrowDown className="h-3 w-3 text-foreground" aria-hidden />;
  }
  return <ArrowUpDown className="h-3 w-3 text-muted-foreground/60" aria-hidden />;
}

type SortableHeadProps = {
  label: string;
  sortKey: SortKey;
  currentSort?: ListingSort;
  onSortChange?: (sort: ListingSort) => void;
  align?: "start" | "end";
  className?: string;
};

function SortableHead({
  label,
  sortKey,
  currentSort,
  onSortChange,
  align = "start",
  className
}: SortableHeadProps) {
  const direction = sortDirectionFor(currentSort, sortKey);

  if (!onSortChange) {
    return (
      <TableHead className={cn(align === "end" ? "text-end" : "", className)}>
        {label}
      </TableHead>
    );
  }

  return (
    <TableHead
      aria-sort={direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none"}
      className={cn(align === "end" ? "text-end" : "", className)}
    >
      <button
        type="button"
        onClick={() => onSortChange(nextSortFor(currentSort, sortKey))}
        className={cn(
          "inline-flex items-center gap-1 rounded-sm text-xs uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          align === "end" && "flex-row-reverse"
        )}
      >
        <span>{label}</span>
        <SortIndicator direction={direction} />
      </button>
    </TableHead>
  );
}

export function ListingsTable({
  locale,
  messages,
  listings,
  compareIds,
  sort,
  onSelect,
  onToggleCompare,
  onSortChange
}: Props) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-surface-2">
      {/* Mobile: rich card layout */}
      <ul className="divide-y divide-border/60 md:hidden">
        {listings.map((listing) => {
          const isSelected = compareIds.includes(listing.id);
          return (
            <li key={listing.id}>
              <button
                type="button"
                onClick={() => onSelect(listing)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-3 text-start transition-colors",
                  isSelected ? "bg-secondary/50" : "active:bg-secondary/40"
                )}
              >
                <span
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCompare(listing);
                  }}
                  className="flex-shrink-0"
                  role="presentation"
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleCompare(listing)}
                    aria-label={messages.listings.compare}
                  />
                </span>
                <span className="flex-shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-md bg-surface-3 text-primary">
                  <PropertyTypeIcon type={listing.property_type} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="num text-sm font-semibold text-foreground">
                      <CurrencyValue value={listing.price} locale={locale} />
                    </span>
                    <span className="num text-[11px] text-muted-foreground">
                      {formatArea(listing.area, locale)}
                    </span>
                  </div>
                  <div className="mt-0.5 inline-flex max-w-full items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 flex-shrink-0" aria-hidden />
                    <span className="truncate">
                      {getDistrictLabel(listing.district_code, locale)} ·{" "}
                      {getCityLabel(listing.city_code, locale)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="h-5 px-1.5 font-normal">
                      {messages.property_type[listing.property_type]}
                    </Badge>
                    <Badge variant="secondary" className="h-5 px-1.5 font-normal">
                      {messages.goal[listing.goal]}
                    </Badge>
                    {typeof listing.bedrooms === "number" ? (
                      <span className="inline-flex items-center gap-0.5 num">
                        <BedDouble className="h-3 w-3" aria-hidden />
                        {formatNumber(listing.bedrooms, locale)}
                      </span>
                    ) : null}
                    {typeof listing.bathrooms === "number" ? (
                      <span className="inline-flex items-center gap-0.5 num">
                        <Bath className="h-3 w-3" aria-hidden />
                        {formatNumber(listing.bathrooms, locale)}
                      </span>
                    ) : null}
                    {listing.price_per_m2 ? (
                      <span className="num">
                        <CurrencyValue value={listing.price_per_m2} locale={locale} />
                        /m²
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Desktop: data table */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-3/40 hover:bg-surface-3/40">
              <TableHead className="w-[44px]" />
              <TableHead className="text-xs uppercase tracking-wide">
                {messages.listings.property_type}
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wide">
                {messages.listings.location}
              </TableHead>
              <SortableHead
                label={messages.listings.price}
                sortKey="price"
                currentSort={sort}
                onSortChange={onSortChange}
                align="end"
              />
              <SortableHead
                label={messages.listings.area}
                sortKey="area"
                currentSort={sort}
                onSortChange={onSortChange}
                align="end"
              />
              <SortableHead
                label={messages.listings.price_per_m2}
                sortKey="price_per_m2"
                currentSort={sort}
                onSortChange={onSortChange}
                align="end"
              />
              <SortableHead
                label={messages.listings.bedrooms}
                sortKey="bedrooms"
                currentSort={sort}
                onSortChange={onSortChange}
                align="end"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow
                key={listing.id}
                className="cursor-pointer transition-colors hover:bg-secondary/40"
                onClick={() => onSelect(listing)}
                data-state={compareIds.includes(listing.id) ? "selected" : undefined}
              >
                <TableCell onClick={(event) => event.stopPropagation()} className="py-2">
                  <Checkbox
                    checked={compareIds.includes(listing.id)}
                    onCheckedChange={() => onToggleCompare(listing)}
                    aria-label={messages.listings.compare}
                  />
                </TableCell>
                <TableCell className="py-2">
                  <span className="inline-flex items-center gap-2">
                    <PropertyTypeIcon
                      type={listing.property_type}
                      className="h-4 w-4 text-muted-foreground"
                    />
                    <span className="text-sm text-foreground">
                      {messages.property_type[listing.property_type]}
                    </span>
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
                      {messages.goal[listing.goal]}
                    </Badge>
                  </span>
                </TableCell>
                <TableCell className="py-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {getDistrictLabel(listing.district_code, locale)}
                  </span>
                  <span className="text-muted-foreground"> · {getCityLabel(listing.city_code, locale)}</span>
                </TableCell>
                <TableCell className="py-2 text-end num text-sm font-medium text-foreground">
                  <CurrencyValue value={listing.price} locale={locale} className="justify-end" />
                </TableCell>
                <TableCell className="py-2 text-end num text-sm text-muted-foreground">
                  {formatArea(listing.area, locale)}
                </TableCell>
                <TableCell className="py-2 text-end num text-sm">
                  {listing.price_per_m2 ? (
                    <span className="inline-flex items-center justify-end gap-1 text-foreground">
                      <CurrencyValue value={listing.price_per_m2} locale={locale} />
                      <span className="text-muted-foreground">/m²</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{messages.common.not_available}</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-end num text-sm">
                  {typeof listing.bedrooms === "number" ? (
                    <span className="text-foreground">{formatNumber(listing.bedrooms, locale)}</span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
