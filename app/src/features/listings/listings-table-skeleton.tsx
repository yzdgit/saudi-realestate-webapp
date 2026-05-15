import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const ROW_COUNT = 8;

export function ListingsTableSkeleton() {
  return (
    <Card className="border-border/70 bg-card/80" aria-busy="true">
      <CardContent className="space-y-3 p-4">
        <div className="hidden grid-cols-[1.5fr_1fr_1fr_1.4fr_0.8fr_0.8fr] gap-3 md:grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={`head-${index}`} className="h-3 w-20" />
          ))}
        </div>
        {Array.from({ length: ROW_COUNT }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-2 gap-3 rounded-lg border border-border/40 bg-card/60 p-3 md:grid-cols-[1.5fr_1fr_1fr_1.4fr_0.8fr_0.8fr] md:items-center md:border-0 md:bg-transparent md:p-2"
          >
            <Skeleton className="col-span-2 h-4 w-3/5 md:col-span-1" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
