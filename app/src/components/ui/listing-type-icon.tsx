import { Building2, Home } from "lucide-react";
import type { ListingType } from "@/lib/realestate/types";
import { cn } from "@/lib/utils";

type Props = {
  type: ListingType;
  className?: string;
};

export function ListingTypeIcon({ type, className }: Props) {
  const Icon = type === "commercial" ? Building2 : Home;

  return <Icon className={cn("h-4 w-4", className)} />;
}
