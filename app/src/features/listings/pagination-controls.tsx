import type { LocaleMessages } from "@/lib/messages";
import { Button } from "@/components/ui/button";

type Props = {
  messages: LocaleMessages;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

export function PaginationControls({ messages, page, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-card/80 px-3 py-2">
      <p className="text-sm text-muted-foreground">
        {messages.listings.page} {page} / {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {messages.pagination.previous}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          {messages.pagination.next}
        </Button>
      </div>
    </div>
  );
}
