import {
  BriefcaseBusiness,
  Building2,
  House,
  LandPlot,
  Square,
  Store,
  Trees,
  Warehouse
} from "lucide-react";
import type { PropertyType } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";

type Props = {
  type: PropertyType;
  className?: string;
};

export function PropertyTypeIcon({ type, className }: Props) {
  const Icon =
    type === "apartment" ||
    type === "building" ||
    type === "floor" ||
    type === "studio" ||
    type === "room"
      ? Building2
      : type === "villa" || type === "duplex" || type === "townhouse" || type === "chalet" || type === "compound"
        ? House
        : type === "land"
          ? LandPlot
          : type === "farm"
            ? Trees
            : type === "office"
              ? BriefcaseBusiness
              : type === "shop"
                ? Store
                : type === "warehouse"
                  ? Warehouse
                  : Square;

  return <Icon className={cn("h-4 w-4", className)} />;
}
