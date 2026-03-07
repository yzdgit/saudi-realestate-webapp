import type { Locale } from "@/lib/i18n";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SarIcon } from "@/components/ui/sar-icon";

type Props = {
  value: number;
  locale: Locale;
  className?: string;
  iconClassName?: string;
};

export function CurrencyValue({ value, locale, className, iconClassName }: Props) {
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <SarIcon className={cn("h-3.5 w-3.5", iconClassName)} />
      <span>{formatCurrency(value, locale)}</span>
    </span>
  );
}
