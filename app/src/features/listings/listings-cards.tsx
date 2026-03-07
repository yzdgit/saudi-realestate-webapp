import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { Listing } from "@/lib/realestate/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyValue } from "@/components/ui/currency-value";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  listings: Listing[];
  compareIds: string[];
  onSelect: (listing: Listing) => void;
  onToggleCompare: (listing: Listing) => void;
};

export function ListingsCards({ locale, messages, listings, compareIds, onSelect, onToggleCompare }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {listings.map((listing) => (
        <Card
          key={listing.id}
          className="cursor-pointer border-border/70 bg-card/80 transition hover:border-primary/40"
          onClick={() => onSelect(listing)}
        >
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <PropertyTypeIcon type={listing.property_type} className="h-3.5 w-3.5" />
                  <span>{messages.property_type[listing.property_type]}</span>
                </Badge>
                <Badge variant="secondary">{messages.goal[listing.goal]}</Badge>
              </div>
              <div onClick={(event) => event.stopPropagation()}>
                <Checkbox
                  checked={compareIds.includes(listing.id)}
                  onCheckedChange={() => onToggleCompare(listing)}
                  aria-label={messages.listings.compare}
                />
              </div>
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">
                <CurrencyValue value={listing.price} locale={locale} />
              </p>
              <p className="text-sm text-muted-foreground">
                {getCityLabel(listing.city_code, locale)} · {getDistrictLabel(listing.district_code, locale)}
              </p>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">{messages.listings.property_type}</p>
              <p>{messages.property_type[listing.property_type]}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{messages.listings.area}</p>
              <p>{formatArea(listing.area, locale)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{messages.listings.bedrooms}</p>
              <p>
                {typeof listing.bedrooms === "number"
                  ? formatNumber(listing.bedrooms, locale)
                  : messages.common.not_available}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">{messages.listings.bathrooms}</p>
              <p>
                {typeof listing.bathrooms === "number"
                  ? formatNumber(listing.bathrooms, locale)
                  : messages.common.not_available}
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <p className="text-xs text-muted-foreground">
              {messages.listings.price_per_m2}: {" "}
              {listing.price_per_m2
                ? (
                  <span className="inline-flex items-center gap-1">
                    <CurrencyValue value={listing.price_per_m2} locale={locale} />
                    <span>/ m²</span>
                  </span>
                )
                : messages.common.not_available}
            </p>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
