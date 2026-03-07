import { useMemo } from "react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber, formatPercent } from "@/lib/format";
import { getCityLabel, getDistrictLabel, getRegionLabel } from "@/lib/location-codes";
import {
  buildAnalyticsSnapshot,
  buildGeoRankingRows,
  getGeoDrillLevel
} from "@/lib/realestate/pipeline";
import type { GeoRankingLevel, ListingFilters, PropertyType, ListingGoal, Listing } from "@/lib/realestate/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CurrencyValue } from "@/components/ui/currency-value";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AnalyticsCharts } from "@/features/charts/analytics-charts";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  filters: ListingFilters;
  listings: Listing[];
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
  listings,
  onPatchFilters
}: Props) {
  const snapshot = useMemo(() => buildAnalyticsSnapshot(listings), [listings]);
  const drillLevel = useMemo(() => getGeoDrillLevel(filters), [filters]);
  const rankingRows = useMemo(() => buildGeoRankingRows(listings, drillLevel), [drillLevel, listings]);

  const handleGoalClick = (goal: ListingGoal) => {
    onPatchFilters(goal === "rent" ? { goal } : { goal, rent_frequency: [] });
  };

  const handlePropertyTypeClick = (propertyType: PropertyType) => {
    if (filters.property_type.length === 1 && filters.property_type[0] === propertyType) {
      onPatchFilters({ property_type: [] });
      return;
    }

    onPatchFilters({ property_type: [propertyType] });
  };

  const handleCityClick = (cityCode: string) => {
    if (filters.city.length === 1 && filters.city[0] === cityCode) {
      onPatchFilters({ city: [] });
      return;
    }

    onPatchFilters({ city: [cityCode] });
  };

  const selectedDistrictCode = filters.district[0];
  const focusedDistrict =
    selectedDistrictCode
      ? rankingRows.find((row) => row.code === selectedDistrictCode) ?? rankingRows[0]
      : undefined;

  return (
    <div className="space-y-4">
      <AnalyticsCharts
        locale={locale}
        messages={messages}
        snapshot={snapshot}
        onGoalClick={handleGoalClick}
        onPropertyTypeClick={handlePropertyTypeClick}
        onCityClick={handleCityClick}
      />

      {focusedDistrict ? (
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle>{getDistrictLabel(focusedDistrict.code, locale)}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
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
            <div>
              <p className="text-xs text-muted-foreground">{messages.goal.sale}</p>
              <p className="font-semibold">{formatPercent(focusedDistrict.saleShare, locale)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{messages.goal.rent}</p>
              <p className="font-semibold">{formatPercent(focusedDistrict.rentShare, locale)}</p>
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
                <TableHead>{messages.goal.sale}</TableHead>
                <TableHead>{messages.goal.rent}</TableHead>
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
                  <TableCell>{formatPercent(row.saleShare, locale)}</TableCell>
                  <TableCell>{formatPercent(row.rentShare, locale)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
