import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { Listing } from "@/lib/realestate/types";
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
  onSelect: (listing: Listing) => void;
  onToggleCompare: (listing: Listing) => void;
};

export function ListingsTable({ locale, messages, listings, compareIds, onSelect, onToggleCompare }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-border/70 bg-card/80">
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
  );
}
