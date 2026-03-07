import { X } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { Listing } from "@/lib/realestate/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyValue } from "@/components/ui/currency-value";
import { PropertyTypeIcon } from "@/components/ui/property-type-icon";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  items: Listing[];
  onRemove: (listingId: string) => void;
  onClear: () => void;
};

export function CompareStrip({ locale, messages, items, onRemove, onClear }: Props) {
  if (items.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/40 bg-card/80">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-sm">{messages.listings.compare_selected}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClear}>
          {messages.filters.clear_all}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border/70 bg-background/50 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <Badge variant="secondary" className="gap-1.5">
                  <PropertyTypeIcon type={item.property_type} className="h-3.5 w-3.5" />
                  <span>{messages.property_type[item.property_type]}</span>
                </Badge>
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-background"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-sm font-medium text-foreground">
                <CurrencyValue value={item.price} locale={locale} />
              </p>
              <p className="text-xs text-muted-foreground">
                {getCityLabel(item.city_code, locale)} · {getDistrictLabel(item.district_code, locale)}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {messages.listings.area}: {formatArea(item.area, locale)}
              </p>
              <p className="text-xs text-muted-foreground">
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
