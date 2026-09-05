import { Skeleton } from "@/components/ui/skeleton"
import { Surface } from "@/components/ui/surface"

/**
 * Route-level skeleton: shaped like a list page (header, toolbar, table),
 * which is what most routes are. Shown by Next while a page's data loads.
 */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite" className="animate-fade-in">
      <div className="mb-5 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="ml-auto h-8 w-36" />
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-border/70 bg-surface-muted/60 px-4 py-3">
          <Skeleton className="h-3 w-1/2" />
        </div>
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-border/60 px-4 py-3.5 last:border-0"
            style={{ opacity: 1 - i * 0.1 }}
          >
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-56" />
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="ml-auto h-3.5 w-20" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        ))}
      </Surface>
    </div>
  )
}
