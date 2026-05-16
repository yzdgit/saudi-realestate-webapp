import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { LocaleMessages } from "@/lib/messages";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";

type Props = {
  locale: Locale;
  messages: LocaleMessages;
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  locale,
  messages,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange
}: Props) {
  if (totalPages <= 1 && (totalItems ?? 0) <= (pageSize ?? 0)) {
    return null;
  }

  const isRtl = locale === "ar";
  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  const showing =
    typeof totalItems === "number" && typeof pageSize === "number"
      ? `${formatNumber(Math.min((page - 1) * pageSize + 1, totalItems), locale)}–${formatNumber(
          Math.min(page * pageSize, totalItems),
          locale
        )}`
      : null;

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-2 px-3 py-2">
      <p className="text-xs text-muted-foreground">
        {showing && typeof totalItems === "number" ? (
          <>
            <span className="num font-medium text-foreground">{showing}</span>{" "}
            <span>of</span>{" "}
            <span className="num font-medium text-foreground">{formatNumber(totalItems, locale)}</span>{" "}
            <span>·</span>{" "}
          </>
        ) : null}
        <span>
          {messages.listings.page}{" "}
          <span className="num font-medium text-foreground">{formatNumber(page, locale)}</span>
          {" / "}
          <span className="num font-medium text-foreground">{formatNumber(totalPages, locale)}</span>
        </span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1 px-2"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={messages.pagination.previous}
        >
          <PrevIcon className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">{messages.pagination.previous}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-1 px-2"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label={messages.pagination.next}
        >
          <span className="hidden sm:inline">{messages.pagination.next}</span>
          <NextIcon className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
