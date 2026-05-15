import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber } from "@/lib/format";
import type { AnalyticsSnapshot } from "@/lib/realestate/types";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyValue } from "@/components/ui/currency-value";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  snapshot: AnalyticsSnapshot;
};

export function StatsRow({ locale, messages, snapshot }: Props) {
  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70 bg-card/80">
        <CardContent className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {messages.kpi.total_listings}
          </p>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {formatNumber(snapshot.totalListings, locale)}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardContent className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {messages.kpi.price_stats}
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.min}</span>
              <CurrencyValue value={snapshot.minPrice} locale={locale} />
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.mean}</span>
              <CurrencyValue value={snapshot.meanPrice} locale={locale} />
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.median}</span>
              <CurrencyValue value={snapshot.medianPrice} locale={locale} />
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.max}</span>
              <CurrencyValue value={snapshot.maxPrice} locale={locale} />
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardContent className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {messages.kpi.price_per_m2_stats}
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.min}</span>
              <span className="inline-flex items-center gap-1">
                <CurrencyValue value={snapshot.minPricePerM2} locale={locale} />
                <span>/ m²</span>
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.mean}</span>
              <span className="inline-flex items-center gap-1">
                <CurrencyValue value={snapshot.meanPricePerM2} locale={locale} />
                <span>/ m²</span>
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.median}</span>
              <span className="inline-flex items-center gap-1">
                <CurrencyValue value={snapshot.medianPricePerM2} locale={locale} />
                <span>/ m²</span>
              </span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.max}</span>
              <span className="inline-flex items-center gap-1">
                <CurrencyValue value={snapshot.maxPricePerM2} locale={locale} />
                <span>/ m²</span>
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardContent className="space-y-2 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {messages.kpi.area_stats}
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.min}</span>
              <span>{formatArea(snapshot.minArea, locale)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.mean}</span>
              <span>{formatArea(snapshot.meanArea, locale)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.median}</span>
              <span>{formatArea(snapshot.medianArea, locale)}</span>
            </p>
            <p className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{messages.common.max}</span>
              <span>{formatArea(snapshot.maxArea, locale)}</span>
            </p>
          </div>
        </CardContent>
      </Card>

    </section>
  );
}
