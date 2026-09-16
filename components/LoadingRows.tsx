// Placeholder rows while a list is still arriving, so the card keeps its
// shape instead of snapping from empty to full.
import { Skeleton } from "@/components/ui/skeleton";

export function LoadingRows({ count = 4, widths = [56, 40, 64, 48] }: { count?: number; widths?: number[] }) {
  return (
    <div className="flex flex-col gap-1 px-1 py-1" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex h-8 items-center gap-2.5 px-2">
          <Skeleton className="size-3.5 rounded-full" />
          <Skeleton className="h-3 rounded" style={{ width: `${widths[index % widths.length]}%` }} />
        </div>
      ))}
    </div>
  );
}
