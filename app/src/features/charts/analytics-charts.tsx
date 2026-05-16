import {
  Bar,
  BarChart,
  CartesianGrid,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis
} from "recharts";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel } from "@/lib/location-codes";
import type { AnalyticsSnapshot } from "@/lib/realestate/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyValue } from "@/components/ui/currency-value";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from "@/components/ui/chart";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  snapshot: AnalyticsSnapshot;
  onCityClick: (city: string) => void;
};

const CHART_PRIMARY = "#22d3ee"; // cyan-400 — matches --primary brand
const CHART_SECONDARY = "#f59e0b"; // amber-500 — used for the orthogonal axis only

// "Nice" axis tick formatter — keeps abbreviated SI suffixes.
function compactNumberFormatter(locale: Locale) {
  return new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
    numberingSystem: "latn"
  });
}

export function AnalyticsCharts({
  locale,
  messages,
  snapshot,
  onCityClick
}: Props) {
  const isArabic = locale === "ar";
  const cityDistribution = snapshot.cityDistribution.map((item) => ({
    ...item,
    cityCode: item.key,
    cityLabel: getCityLabel(item.key, locale)
  }));

  const districtAvgPricePerM2 = snapshot.districtAvgPricePerM2.map((item) => ({
    ...item,
    districtLabel: getDistrictLabel(item.districtCode, locale)
  }));
  const horizontalBarMargin = isArabic ? { right: 16, left: 16 } : { left: 16, right: 16 };
  const cityAxisWidth = isArabic ? 140 : 110;
  const districtAxisWidth = isArabic ? 180 : 150;
  const categoryAxisOrientation = isArabic ? "right" : "left";
  const tickFormat = compactNumberFormatter(locale);
  const compactTick = (value: number) => tickFormat.format(value);

  const tickStyle = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card data-section className="border-border/70 bg-surface-2/90">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="text-base font-semibold">
            {messages.analytics.city_distribution}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <ChartContainer
            config={{ count: { label: messages.common.count, color: CHART_PRIMARY } }}
            className="h-[280px] w-full"
          >
            <BarChart data={cityDistribution} layout="vertical" margin={horizontalBarMargin}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
              />
              <YAxis
                type="category"
                dataKey="cityLabel"
                width={cityAxisWidth}
                orientation={categoryAxisOrientation}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={tickStyle}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="value"
                fill={CHART_PRIMARY}
                radius={[0, 4, 4, 0]}
                onClick={(item) => onCityClick(item.cityCode)}
                cursor="pointer"
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card data-section className="border-border/70 bg-surface-2/90">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="text-base font-semibold">
            {messages.analytics.district_price_per_m2}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <ChartContainer
            config={{ value: { label: messages.listings.price_per_m2, color: CHART_PRIMARY } }}
            className="h-[280px] w-full"
          >
            <BarChart data={districtAvgPricePerM2} layout="vertical" margin={horizontalBarMargin}>
              <CartesianGrid horizontal={false} stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
              />
              <YAxis
                type="category"
                dataKey="districtLabel"
                width={districtAxisWidth}
                orientation={categoryAxisOrientation}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={tickStyle}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="inline-flex items-center gap-1 num">
                        <CurrencyValue value={Number(value)} locale={locale} />
                        <span className="text-muted-foreground">/m²</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="value" fill={CHART_PRIMARY} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card data-section className="border-border/70 bg-surface-2/90">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="text-base font-semibold">
            {messages.analytics.price_histogram}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <ChartContainer
            config={{ count: { label: messages.common.count, color: CHART_PRIMARY } }}
            className="h-[280px] w-full"
          >
            <BarChart data={snapshot.priceHistogram} margin={{ top: 16, right: 12, bottom: 24, left: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                dy={12}
                tick={{ ...tickStyle, fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card data-section className="border-border/70 bg-surface-2/90">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="text-base font-semibold">
            {messages.analytics.area_histogram}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <ChartContainer
            config={{ count: { label: messages.common.count, color: CHART_PRIMARY } }}
            className="h-[280px] w-full"
          >
            <BarChart data={snapshot.areaHistogram} margin={{ top: 16, right: 12, bottom: 24, left: 4 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                dataKey="range"
                tickLine={false}
                axisLine={false}
                interval={0}
                angle={-20}
                dy={12}
                tick={{ ...tickStyle, fontSize: 10 }}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill={CHART_PRIMARY} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card data-section className="border-border/70 bg-surface-2/90 lg:col-span-2">
        <CardHeader className="px-5 pb-2 pt-5">
          <CardTitle className="text-base font-semibold">
            {messages.analytics.area_price_scatter}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-4">
          <ChartContainer
            config={{
              area: { label: messages.listings.area, color: CHART_PRIMARY },
              price: { label: messages.listings.price, color: CHART_SECONDARY }
            }}
            className="h-[320px] w-full"
          >
            <ScatterChart margin={{ top: 12, right: 12, bottom: 28, left: 12 }}>
              <CartesianGrid stroke="hsl(var(--border) / 0.4)" />
              <XAxis
                dataKey="area"
                type="number"
                name={messages.listings.area}
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
                label={{
                  value: `${messages.listings.area} (m²)`,
                  position: "insideBottom",
                  offset: -12,
                  style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 }
                }}
              />
              <YAxis
                dataKey="price"
                type="number"
                name={messages.listings.price}
                tickLine={false}
                axisLine={false}
                tick={tickStyle}
                tickFormatter={compactTick}
                label={{
                  value: messages.listings.price,
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "hsl(var(--muted-foreground))", fontSize: 11, textAnchor: "middle" }
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === messages.listings.price) {
                        return <CurrencyValue value={Number(value)} locale={locale} />;
                      }

                      return <span className="num">{formatNumber(Number(value), locale)}</span>;
                    }}
                  />
                }
              />
              <Scatter data={snapshot.scatter} fill={CHART_SECONDARY} fillOpacity={0.55} />
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}

