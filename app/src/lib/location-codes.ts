import type { Locale } from "@/lib/i18n";
import {
  cityCodes,
  cityParentCodes,
  districtCodes,
  districtParentCodes,
  regionCodes,
  type LocalizedLabel
} from "@/lib/location-codes.generated";

function resolveLabel(map: Record<string, LocalizedLabel>, code: string, locale: Locale): string {
  const item = map[code];

  if (!item) {
    return code;
  }

  return locale === "ar" ? item.ar : item.en;
}

export function getRegionLabel(code: string, locale: Locale): string {
  return resolveLabel(regionCodes, code, locale);
}

export function getCityLabel(code: string, locale: Locale): string {
  return resolveLabel(cityCodes, code, locale);
}

export function getDistrictLabel(code: string, locale: Locale): string {
  return resolveLabel(districtCodes, code, locale);
}

export function getCityRegionCode(cityCode: string): string | undefined {
  return cityParentCodes[cityCode]?.regionCode;
}

export function getDistrictCityCode(districtCode: string): string | undefined {
  return districtParentCodes[districtCode]?.cityCode;
}

export function getDistrictRegionCode(districtCode: string): string | undefined {
  return districtParentCodes[districtCode]?.regionCode;
}
