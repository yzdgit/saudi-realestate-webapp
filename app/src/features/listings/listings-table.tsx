import { Building2, Home, KeyRound, Landmark, Square } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { Listing } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyValue } from "@/components/ui/currency-value";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";
import { SarIcon } from "@/components/ui/sar-icon";
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
  onSelect: (listing: Listing) => void;
  onToggleCompare: (listing: Listing) => void;
};

export function ListingsTable({ locale, messages, listings, compareIds, onSelect, onToggleCompare }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
      <div className="md:hidden">
        <div className="grid grid-cols-[40px_repeat(3,minmax(0,1fr))] items-center border-b border-border/70 px-2 py-2">
          <div />
          <div className="flex items-center justify-center" title={messages.listings.property_type}>
            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">{messages.listings.property_type}</span>
          </div>
          <div className="flex items-center justify-center" title={messages.listings.price}>
            <SarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">{messages.listings.price}</span>
          </div>
          <div className="flex items-center justify-center" title={messages.listings.area}>
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="sr-only">{messages.listings.area}</span>
          </div>
        </div>

        {listings.map((listing) => (
          <div
            key={listing.id}
            className={cn(
              "grid cursor-pointer grid-cols-[40px_repeat(3,minmax(0,1fr))] gap-2 border-b border-border/60 px-2 py-2 transition-colors",
              compareIds.includes(listing.id) ? "bg-muted" : "hover:bg-muted/50"
            )}
            onClick={() => onSelect(listing)}
          >
            <div
              className="flex items-start justify-center pt-0.5"
              onClick={(event) => event.stopPropagation()}
            >
              <Checkbox
                checked={compareIds.includes(listing.id)}
                onCheckedChange={() => onToggleCompare(listing)}
                aria-label={messages.listings.compare}
              />
            </div>

            <div className="flex min-w-0 flex-col items-center gap-1">
              <PropertyTypeIcon type={listing.property_type} className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="h-5 px-1.5" title={messages.goal[listing.goal]}>
                {listing.goal === "sale" ? <Landmark className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
                <span className="sr-only">{messages.goal[listing.goal]}</span>
              </Badge>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="truncate text-xs font-medium">
                <CurrencyValue value={listing.price} locale={locale} />
              </div>
              <Badge variant="secondary" className="h-5 w-fit gap-1 px-1.5 text-[10px] whitespace-nowrap">
                <SarIcon className="h-3 w-3" />
                {listing.price_per_m2
                  ? (
                    <>
                      <span>{formatNumber(listing.price_per_m2, locale)}</span>
                      <span>/m²</span>
                    </>
                  )
                  : messages.common.not_available}
              </Badge>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <div className="truncate text-xs">{formatArea(listing.area, locale)}</div>
              <Badge variant="secondary" className="h-5 w-fit gap-1 px-1.5 text-[10px] whitespace-nowrap">
                <Home className="h-3 w-3" />
                {typeof listing.rooms === "number"
                  ? formatNumber(listing.rooms, locale)
                  : messages.common.not_available}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[44px]" />
              <TableHead>{messages.listings.goal}</TableHead>
              <TableHead>{messages.listings.property_type}</TableHead>
              <TableHead>{messages.listings.location}</TableHead>
              <TableHead>{messages.listings.price}</TableHead>
              <TableHead>{messages.listings.area}</TableHead>
              <TableHead>{messages.listings.price_per_m2}</TableHead>
              <TableHead>{messages.listings.bedrooms}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listings.map((listing) => (
              <TableRow
                key={listing.id}
                className="cursor-pointer"
                onClick={() => onSelect(listing)}
                data-state={compareIds.includes(listing.id) ? "selected" : undefined}
              >
                <TableCell onClick={(event) => event.stopPropagation()}>
                  <Checkbox
                    checked={compareIds.includes(listing.id)}
                    onCheckedChange={() => onToggleCompare(listing)}
                    aria-label={messages.listings.compare}
                  />
                </TableCell>
                <TableCell>{messages.goal[listing.goal]}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-2">
                    <PropertyTypeIcon type={listing.property_type} className="text-muted-foreground" />
                    <span>{messages.property_type[listing.property_type]}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {getCityLabel(listing.city_code, locale)} · {getDistrictLabel(listing.district_code, locale)}
                </TableCell>
                <TableCell>
                  <CurrencyValue value={listing.price} locale={locale} />
                </TableCell>
                <TableCell>{formatArea(listing.area, locale)}</TableCell>
                <TableCell>
                  {listing.price_per_m2
                    ? (
                      <span className="inline-flex items-center gap-1">
                        <CurrencyValue value={listing.price_per_m2} locale={locale} />
                        <span>/ m²</span>
                      </span>
                    )
                    : messages.common.not_available}
                </TableCell>
                <TableCell>
                  {typeof listing.bedrooms === "number"
                    ? formatNumber(listing.bedrooms, locale)
                    : messages.common.not_available}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
