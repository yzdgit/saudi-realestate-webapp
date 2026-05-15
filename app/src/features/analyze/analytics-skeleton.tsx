import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AnalyticsSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="border-border/70 bg-card/80">
            <CardContent className="space-y-3 p-4">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-[180px] w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border/70 bg-card/80">
        <CardContent className="space-y-3 p-4">
          <Skeleton className="h-3 w-40" />
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
