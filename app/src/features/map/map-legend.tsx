import type { LocaleMessages } from "@/lib/messages";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { MapOverlayMode } from "@/features/map/listings-map";

type Props = {
  messages: LocaleMessages;
  overlayMode: MapOverlayMode;
  onOverlayModeChange: (mode: MapOverlayMode) => void;
  isAnalyzeMode?: boolean;
  visibleCount: number;
  totalCount: number;
};

export function MapLegend({
  messages,
  overlayMode,
  onOverlayModeChange,
  isAnalyzeMode = false,
  visibleCount,
  totalCount
}: Props) {
  return (
    <Card className="border-border/70 bg-card/80">
      <CardHeader>
        <CardTitle className="text-base">{messages.map.legend_title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{messages.map.overlay_mode}</p>
          {isAnalyzeMode ? (
            <div className="rounded-md border border-border/70 px-3 py-2 text-sm text-foreground/90">
              {messages.map.mode_intensity}
            </div>
          ) : (
            <RadioGroup
              value={overlayMode}
              onValueChange={(value) => onOverlayModeChange(value as MapOverlayMode)}
              className="grid gap-2"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="markers" />
                <span>{messages.map.mode_markers}</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="intensity" />
                <span>{messages.map.mode_intensity}</span>
              </label>
            </RadioGroup>
          )}
        </div>

        <div className="rounded-lg border border-border/70 p-3 text-sm">
          <p className="text-muted-foreground">{messages.map.visible_listings}</p>
          <p className="mt-1 font-semibold text-foreground">
            {visibleCount} / {totalCount}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
