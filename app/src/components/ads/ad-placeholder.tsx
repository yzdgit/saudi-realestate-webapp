import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type AdPlaceholderVariant = "table" | "stats";

type Props = {
  variant?: AdPlaceholderVariant;
  className?: string;
};

const ADSENSE_CLIENT_ID =
  process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "ca-pub-7743605693493615";

const SLOT_BY_VARIANT: Record<AdPlaceholderVariant, string> = {
  table: "5152188352",
  stats: "1516049880"
};

type AdsByGoogleWindow = Window & {
  adsbygoogle?: unknown[];
};

export function AdPlaceholder({ variant = "stats", className }: Props) {
  const slot = SLOT_BY_VARIANT[variant];
  const adRef = useRef<HTMLModElement | null>(null);
  const isReady = Boolean(ADSENSE_CLIENT_ID && slot);

  useEffect(() => {
    if (!isReady || !adRef.current) {
      return;
    }

    if (adRef.current.getAttribute("data-adsbygoogle-status") === "done") {
      return;
    }

    try {
      ((window as AdsByGoogleWindow).adsbygoogle =
        (window as AdsByGoogleWindow).adsbygoogle || []).push({});
    } catch {
      // Ignore transient AdSense init errors (ad blockers / race conditions).
    }
  }, [isReady, slot]);

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
          "p-4",
          variant === "table" ? "min-h-16" : "min-h-[180px]"
        )}
      >
        <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Ad</p>
        {isReady ? (
          <ins
            ref={adRef}
            className="adsbygoogle"
            style={{ display: "block" }}
            data-ad-client={ADSENSE_CLIENT_ID}
            data-ad-slot={slot}
            data-ad-format="auto"
            data-full-width-responsive="true"
          />
        ) : (
          <p className="text-xs text-muted-foreground">
            Missing `NEXT_PUBLIC_ADSENSE_CLIENT`.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
