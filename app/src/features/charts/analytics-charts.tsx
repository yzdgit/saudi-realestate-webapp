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

export function AnalyticsCharts({
  locale,
  messages,
  snapshot,
  onCityClick
}: Props) {
  const cityDistribution = snapshot.cityDistribution.map((item) => ({
    ...item,
    cityCode: item.key,
    cityLabel: getCityLabel(item.key, locale)
  }));

  const districtAvgPricePerM2 = snapshot.districtAvgPricePerM2.map((item) => ({
    ...item,
    districtLabel: getDistrictLabel(item.districtCode, locale)
  }));

  return (
    <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{messages.analytics.city_distribution}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: messages.common.count, color: "#22d3ee" } }} className="h-[320px] w-full">
            <BarChart data={cityDistribution} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="cityLabel" width={100} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="#22d3ee" radius={6} onClick={(item) => onCityClick(item.cityCode)} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{messages.analytics.district_price_per_m2}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ value: { label: messages.listings.price_per_m2, color: "#a3e635" } }} className="h-[320px] w-full">
            <BarChart data={districtAvgPricePerM2} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="districtLabel" width={140} tickLine={false} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => (
                      <span className="inline-flex items-center gap-1">
                        <CurrencyValue value={Number(value)} locale={locale} />
                        <span>/ m²</span>
                      </span>
                    )}
                  />
                }
              />
              <Bar dataKey="value" fill="#a3e635" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{messages.analytics.price_histogram}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: messages.common.count, color: "#38bdf8" } }} className="h-[320px] w-full">
            <BarChart data={snapshot.priceHistogram}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="range" tickLine={false} axisLine={false} interval={0} angle={-20} dy={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#38bdf8" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{messages.analytics.area_histogram}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={{ count: { label: messages.common.count, color: "#14b8a6" } }} className="h-[320px] w-full">
            <BarChart data={snapshot.areaHistogram}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="range" tickLine={false} axisLine={false} interval={0} angle={-20} dy={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="#14b8a6" radius={6} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{messages.analytics.area_price_scatter}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              area: { label: messages.listings.area, color: "#22d3ee" },
              price: { label: messages.listings.price, color: "#f59e0b" }
            }}
            className="h-[320px] w-full"
          >
            <ScatterChart>
              <CartesianGrid />
              <XAxis
                dataKey="area"
                type="number"
                name={messages.listings.area}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                dataKey="price"
                type="number"
                name={messages.listings.price}
                tickLine={false}
                axisLine={false}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === messages.listings.price) {
                        return <CurrencyValue value={Number(value)} locale={locale} />;
                      }

                      return formatNumber(Number(value), locale);
                    }}
                  />
                }
              />
              <Scatter data={snapshot.scatter} fill="#f59e0b" />
            </ScatterChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
