import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, GitCompare, MapPin } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel, getRegionLabel } from "@/lib/location-codes";
import { loadListingUri } from "@/lib/realestate/dataset";
import type { Listing } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";
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
  isInCompare?: boolean;
  canAddToCompare?: boolean;
  onToggleCompare?: (listing: Listing) => void;
};

function hasValue(value: number | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

function StaticMapPreview({ latitude, longitude }: { latitude: number; longitude: number }) {
  const zoom = 14;
  const { x, y } = lonLatToTile(longitude, latitude, zoom);
  const tileUrl = `https://a.basemaps.cartocdn.com/dark_all/${zoom}/${x}/${y}@2x.png`;

  return (
    <div className="relative h-40 overflow-hidden rounded-lg border border-border/70 bg-surface-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tileUrl}
        alt=""
        aria-hidden
        className="h-full w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="relative inline-flex h-6 w-6 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
        </span>
      </div>
    </div>
  );
}

export function ListingDetailsDrawer({
  locale,
  messages,
  listing,
  open,
  onOpenChange,
  isInCompare = false,
  canAddToCompare = true,
  onToggleCompare
}: Props) {
  const [resolvedUri, setResolvedUri] = useState<string | undefined>(listing?.listing_uri);

  useEffect(() => {
    if (!open || !listing) {
      return;
    }

    if (listing.listing_uri) {
      setResolvedUri(listing.listing_uri);
      return;
    }

    let cancelled = false;
    setResolvedUri(undefined);
    void loadListingUri(listing.id)
      .then((uri) => {
        if (!cancelled) setResolvedUri(uri);
      })
      .catch(() => {
        if (!cancelled) setResolvedUri(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [open, listing]);

  const cityLabel = listing ? getCityLabel(listing.city_code, locale) : "";
  const districtLabel = listing ? getDistrictLabel(listing.district_code, locale) : "";
  const regionLabel = listing ? getRegionLabel(listing.region_code, locale) : "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={locale === "ar" ? "left" : "right"}
        className="w-full overflow-y-auto border-border/70 bg-background p-0 sm:max-w-lg"
      >
        {!listing ? (
          <div className="space-y-4 p-5">
            <SheetHeader>
              <SheetTitle>{messages.listings.details_title}</SheetTitle>
            </SheetHeader>
            <p className="text-sm text-muted-foreground">{messages.listings.no_selection}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 p-5">
            <SheetHeader className="space-y-3 pe-10">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <PropertyTypeIcon type={listing.property_type} className="h-3.5 w-3.5" />
                  <span>{messages.property_type[listing.property_type]}</span>
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <ListingTypeIcon type={listing.listing_type} className="h-3.5 w-3.5" />
                  <span>{messages.listing_type[listing.listing_type]}</span>
                </Badge>
                <Badge variant="outline">{messages.goal[listing.goal]}</Badge>
              </div>
              <SheetTitle className="text-2xl font-semibold tracking-tight">
                <CurrencyValue value={listing.price} locale={locale} className="num" />
              </SheetTitle>
              <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" aria-hidden />
                <span>
                  {[districtLabel, cityLabel, regionLabel].filter(Boolean).join(" · ")}
                </span>
              </p>
              {onToggleCompare ? (
                <div>
                  <Button
                    variant={isInCompare ? "default" : "outline"}
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onToggleCompare(listing)}
                    disabled={!isInCompare && !canAddToCompare}
                    aria-pressed={isInCompare}
                  >
                    <GitCompare className="h-3.5 w-3.5" aria-hidden />
                    <span>{isInCompare ? messages.listings.in_compare : messages.listings.compare}</span>
                  </Button>
                </div>
              ) : null}
            </SheetHeader>

            <StaticMapPreview latitude={listing.latitude} longitude={listing.longitude} />

            <Separator />

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                  {messages.listings.area}
                </dt>
                <dd className="mt-0.5 num font-medium text-foreground">
                  {formatArea(listing.area, locale)}
                </dd>
              </div>
              {listing.price_per_m2 ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.price_per_m2}
                  </dt>
                  <dd className="mt-0.5 inline-flex items-center gap-1 num font-medium text-foreground">
                    <CurrencyValue value={listing.price_per_m2} locale={locale} />
                    <span className="text-muted-foreground">/m²</span>
                  </dd>
                </div>
              ) : null}
              {hasValue(listing.bedrooms) ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.bedrooms}
                  </dt>
                  <dd className="mt-0.5 num font-medium text-foreground">
                    {formatNumber(listing.bedrooms, locale)}
                  </dd>
                </div>
              ) : null}
              {hasValue(listing.bathrooms) ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.bathrooms}
                  </dt>
                  <dd className="mt-0.5 num font-medium text-foreground">
                    {formatNumber(listing.bathrooms, locale)}
                  </dd>
                </div>
              ) : null}
              {hasValue(listing.living_rooms) ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.living_rooms}
                  </dt>
                  <dd className="mt-0.5 num font-medium text-foreground">
                    {formatNumber(listing.living_rooms, locale)}
                  </dd>
                </div>
              ) : null}
              {hasValue(listing.rooms) ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.rooms}
                  </dt>
                  <dd className="mt-0.5 num font-medium text-foreground">
                    {formatNumber(listing.rooms, locale)}
                  </dd>
                </div>
              ) : null}
              {listing.rent_frequency ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {messages.listings.rent_frequency}
                  </dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {messages.rent_frequency[listing.rent_frequency]}
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className={cn("mt-auto", resolvedUri ? "" : "opacity-60")}>
              {resolvedUri ? (
                <Button asChild className="w-full gap-2">
                  <Link href={resolvedUri} target="_blank" rel="noreferrer">
                    {messages.listings.open_source}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button className="w-full gap-2" disabled>
                  {messages.listings.open_source}
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
