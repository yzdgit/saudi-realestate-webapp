import { SearchX } from "lucide-react";
import type { LocaleMessages } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  messages: LocaleMessages;
  onReset: () => void;
};

export function ListingsEmptyState({ messages, onReset }: Props) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-border/60 bg-muted/30 text-muted-foreground">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">{messages.listings.no_results_title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{messages.listings.no_results_description}</p>
        </div>
        <Button onClick={onReset} variant="outline" size="sm">
          {messages.filters.clear_all}
        </Button>
      </CardContent>
    </Card>
  );
}
