import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber } from "@/lib/format";
import { getCityLabel, getDistrictLabel, getRegionLabel } from "@/lib/location-codes";
import type {
  AnalyticsSnapshot,
  GeoRankingLevel,
  GeoRankingRow,
  ListingFilters
} from "@/lib/realestate/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyValue } from "@/components/ui/currency-value";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsCharts } from "@/features/charts/analytics-charts";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  filters: ListingFilters;
  drillLevel: GeoRankingLevel;
  snapshot: AnalyticsSnapshot;
  rankingRows: GeoRankingRow[];
  onPatchFilters: (patch: Partial<ListingFilters>) => void;
};

const levelLabel = (level: GeoRankingLevel, messages: LocaleMessages): string => {
  if (level === "region") {
    return messages.filters.region;
  }

  if (level === "city") {
    return messages.filters.city;
  }

  return messages.filters.district;
};

const nameForCode = (
  level: GeoRankingLevel,
  code: string,
  locale: Locale
): string => {
  if (level === "region") {
    return getRegionLabel(code, locale);
  }

  if (level === "city") {
    return getCityLabel(code, locale);
  }

  return getDistrictLabel(code, locale);
};

export function ListingsAnalyzeView({
  locale,
  messages,
  filters,
  drillLevel,
  snapshot,
  rankingRows,
  onPatchFilters
}: Props) {
  const handleCityClick = (cityCode: string) => {
    if (filters.city.length === 1 && filters.city[0] === cityCode) {
      onPatchFilters({ city: [] });
      return;
    }

    onPatchFilters({ city: [cityCode] });
  };

  const selectedDistrictCode = filters.district[0];
  const focusedDistrict =
    drillLevel === "district" && selectedDistrictCode
      ? rankingRows.find((row) => row.code === selectedDistrictCode)
      : undefined;

  return (
    <div className="space-y-4">
      <AnalyticsCharts
        locale={locale}
        messages={messages}
        snapshot={snapshot}
        onCityClick={handleCityClick}
      />

      {focusedDistrict ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>{getDistrictLabel(focusedDistrict.code, locale)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{messages.kpi.total_listings}</p>
              <p className="font-semibold">{formatNumber(focusedDistrict.count, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{messages.kpi.median_price}</p>
              <p className="font-semibold">
                <CurrencyValue value={focusedDistrict.medianPrice} locale={locale} />
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/70 bg-card/80">
        <CardHeader>
          <CardTitle>{levelLabel(drillLevel, messages)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{levelLabel(drillLevel, messages)}</TableHead>
                <TableHead>{messages.kpi.total_listings}</TableHead>
                <TableHead>{messages.kpi.median_price}</TableHead>
                <TableHead>{messages.kpi.median_price_per_m2}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingRows.map((row) => (
                <TableRow key={`${row.level}-${row.code}`}>
                  <TableCell>{nameForCode(row.level, row.code, locale)}</TableCell>
                  <TableCell>{formatNumber(row.count, locale)}</TableCell>
                  <TableCell>
                    <CurrencyValue value={row.medianPrice} locale={locale} />
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <CurrencyValue value={row.medianPricePerM2} locale={locale} />
                      <span>/ m²</span>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
