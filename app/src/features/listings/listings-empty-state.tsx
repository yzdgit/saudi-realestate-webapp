import type { LocaleMessages } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  messages: LocaleMessages;
  onReset: () => void;
};

export function ListingsEmptyState({ messages, onReset }: Props) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle>{messages.listings.no_results_title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{messages.listings.no_results_description}</p>
        <Button onClick={onReset}>{messages.filters.clear_all}</Button>
      </CardContent>
    </Card>
  );
}
