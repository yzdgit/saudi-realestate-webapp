import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

export function MapSkeleton({ className }: Props) {
  return (
    <div
      className={cn(
        "relative h-[58vh] min-h-[420px] overflow-hidden rounded-xl border border-border/60 bg-muted/20",
        className
      )}
      aria-busy="true"
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }}
      />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-transparent via-primary/5 to-transparent" />
      <div className="absolute end-3 top-3 h-7 w-32 animate-pulse rounded-md bg-card/80" />
      <div className="absolute bottom-3 start-3 h-16 w-48 animate-pulse rounded-md bg-card/80" />
    </div>
  );
}
