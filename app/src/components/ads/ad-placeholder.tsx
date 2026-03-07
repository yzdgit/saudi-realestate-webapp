import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type AdPlaceholderVariant = "table" | "stats";

type Props = {
  variant?: AdPlaceholderVariant;
  className?: string;
};

export function AdPlaceholder({ variant = "stats", className }: Props) {
  return (
    <Card
      className={cn(
        "border-dashed border-border/70 bg-card/70",
        variant === "table" ? "overflow-hidden" : "",
        className
      )}
    >
      <CardContent
        className={cn(
          "flex items-center justify-between gap-3 p-4 text-sm",
          variant === "table" ? "min-h-16" : ""
        )}
      >
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Ad</p>
          <p className="font-medium text-foreground/90">Google Ads Placeholder</p>
        </div>
        <p className="text-xs text-muted-foreground">Slot ready for AdSense embed</p>
      </CardContent>
    </Card>
  );
}
