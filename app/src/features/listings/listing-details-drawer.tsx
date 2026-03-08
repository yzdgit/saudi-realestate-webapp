import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatDecimal, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel, getRegionLabel } from "@/lib/location-codes";
import type { Listing } from "@/lib/realestate/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CurrencyValue } from "@/components/ui/currency-value";
import { ListingTypeIcon } from "@/components/ui/listing-type-icon";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  listing: Listing | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ListingDetailsDrawer({ locale, messages, listing, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="w-full overflow-y-auto border-border/70 bg-background p-0 sm:max-w-lg"
      >
        <div className="space-y-4 p-5">
          <SheetHeader>
            <SheetTitle>{messages.listings.details_title}</SheetTitle>
          </SheetHeader>

          {!listing ? (
            <p className="text-sm text-muted-foreground">{messages.listings.no_selection}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <ListingTypeIcon type={listing.listing_type} className="h-3.5 w-3.5" />
                  <span>{messages.listing_type[listing.listing_type]}</span>
                </Badge>
                <Badge variant="secondary">{messages.goal[listing.goal]}</Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <PropertyTypeIcon type={listing.property_type} className="h-3.5 w-3.5" />
                  <span>{messages.property_type[listing.property_type]}</span>
                </Badge>
              </div>

              <div>
                <p className="text-lg font-semibold text-foreground">
                  <CurrencyValue value={listing.price} locale={locale} />
                </p>
                <p className="text-sm text-muted-foreground">
                  {getCityLabel(listing.city_code, locale)} · {getDistrictLabel(listing.district_code, locale)}
                </p>
              </div>

              <Separator />

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">{messages.listings.area}</dt>
                  <dd>{formatArea(listing.area, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.price_per_m2}</dt>
                  <dd>
                    {listing.price_per_m2
                      ? (
                        <span className="inline-flex items-center gap-1">
                          <CurrencyValue value={listing.price_per_m2} locale={locale} />
                          <span>/ m²</span>
                        </span>
                      )
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.rooms}</dt>
                  <dd>
                    {typeof listing.rooms === "number"
                      ? formatNumber(listing.rooms, locale)
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.bedrooms}</dt>
                  <dd>
                    {typeof listing.bedrooms === "number"
                      ? formatNumber(listing.bedrooms, locale)
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.bathrooms}</dt>
                  <dd>
                    {typeof listing.bathrooms === "number"
                      ? formatNumber(listing.bathrooms, locale)
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.living_rooms}</dt>
                  <dd>
                    {typeof listing.living_rooms === "number"
                      ? formatNumber(listing.living_rooms, locale)
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.rent_frequency}</dt>
                  <dd>
                    {listing.rent_frequency
                      ? messages.rent_frequency[listing.rent_frequency]
                      : messages.common.not_available}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.filters.city}</dt>
                  <dd>{getCityLabel(listing.city_code, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.filters.district}</dt>
                  <dd>{getDistrictLabel(listing.district_code, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.region}</dt>
                  <dd>{getRegionLabel(listing.region_code, locale)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{messages.listings.coordinates}</dt>
                  <dd>
                    {formatDecimal(listing.latitude, locale, 4)}, {formatDecimal(listing.longitude, locale, 4)}
                  </dd>
                </div>
              </dl>

              <Separator />

              <Button asChild className="w-full gap-2">
                <Link href={listing.listing_uri} target="_blank" rel="noreferrer">
                  {messages.listings.open_source}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
