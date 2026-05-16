import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatArea, formatNumber, formatPercent } from "@/lib/format";
import type { AnalyticsSnapshot } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";
import { CurrencyValue } from "@/components/ui/currency-value";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  snapshot: AnalyticsSnapshot;
  variant?: "panel" | "overlay";
  className?: string;
};

type Metric = {
  key: string;
  label: string;
  value: React.ReactNode;
};

export function StatsRow({ locale, messages, snapshot, variant = "panel", className }: Props) {
  const hasData = snapshot.totalListings > 0;

  const metrics: Metric[] = [
    {
      key: "total",
      label: messages.kpi.total_listings,
      value: <span className="num">{formatNumber(snapshot.totalListings, locale)}</span>
    },
    {
      key: "median-price",
      label: messages.kpi.median_price,
      value: hasData ? (
        <CurrencyValue value={snapshot.medianPrice} locale={locale} className="num" />
      ) : (
        <span className="num text-muted-foreground">—</span>
      )
    },
    {
      key: "median-price-per-m2",
      label: messages.kpi.median_price_per_m2,
      value: hasData ? (
        <span className="inline-flex items-center gap-1 num">
          <CurrencyValue value={snapshot.medianPricePerM2} locale={locale} />
          <span className="text-muted-foreground">/m²</span>
        </span>
      ) : (
        <span className="num text-muted-foreground">—</span>
      )
    },
    {
      key: "median-area",
      label: messages.kpi.median_area,
      value: hasData ? (
        <span className="num">{formatArea(snapshot.medianArea, locale)}</span>
      ) : (
        <span className="num text-muted-foreground">—</span>
      )
    },
    {
      key: "mix",
      label: messages.kpi.rent_sale_mix,
      value: hasData ? (
        <span className="num">
          {formatPercent(snapshot.saleShare, locale)}
          <span className="text-muted-foreground"> · </span>
          {formatPercent(snapshot.rentShare, locale)}
        </span>
      ) : (
        <span className="num text-muted-foreground">—</span>
      )
    }
  ];

  if (variant === "overlay") {
    return (
      <div
        className={cn(
          "pointer-events-auto inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-border/70 bg-surface-2/90 px-3 py-2 text-xs shadow-lg backdrop-blur-sm",
          className
        )}
        data-section
      >
        {metrics.map((metric, index) => (
          <div key={metric.key} className="flex items-baseline gap-2">
            <span className="uppercase tracking-wide text-muted-foreground">{metric.label}</span>
            <span className="font-medium text-foreground">{metric.value}</span>
            {index < metrics.length - 1 ? (
              <span className="hidden text-border md:inline">|</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section
      data-section
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/40 sm:grid-cols-3 lg:grid-cols-5",
        className
      )}
    >
      {metrics.map((metric) => (
        <div key={metric.key} className="bg-surface-2 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {metric.label}
          </p>
          <p className="mt-1.5 text-base font-semibold text-foreground sm:text-lg">{metric.value}</p>
        </div>
      ))}
    </section>
  );
}
