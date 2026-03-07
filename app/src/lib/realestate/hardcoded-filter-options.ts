import {
  cityCodes,
  districtCodes,
  regionCodes
} from "@/lib/location-codes.generated";
import type { FilterOptionSet } from "@/lib/realestate/types";

const PROPERTY_TYPES: FilterOptionSet["property_type"] = [
  "apartment",
  "villa",
  "land",
  "duplex",
  "townhouse",
  "office",
  "shop",
  "warehouse",
  "building",
  "farm",
  "chalet",
  "compound",
  "floor",
  "studio",
  "room",
  "other"
];

const GOALS: FilterOptionSet["goal"] = ["sale", "rent"];
const LISTING_TYPES: FilterOptionSet["listing_type"] = ["residential", "commercial"];

function codeSort(left: string, right: string): number {
  const leftNumber = Number(left);
  const rightNumber = Number(right);

  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }

  return left.localeCompare(right, "en");
}

function sortedCodes(map: Record<string, unknown>): string[] {
  return Object.keys(map).sort(codeSort);
}

export const HARDCODED_FILTER_OPTIONS: FilterOptionSet = {
  goal: GOALS,
  rent_frequency: [],
  property_type: PROPERTY_TYPES,
  listing_type: LISTING_TYPES,
  region: sortedCodes(regionCodes),
  city: sortedCodes(cityCodes),
  district: sortedCodes(districtCodes)
};
