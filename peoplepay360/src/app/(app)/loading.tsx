import { Skeleton } from "@/components/ui/skeleton"
import { Surface } from "@/components/ui/surface"

/**
 * Route-level skeleton. Header, a bento row (one wide block, four tiles —
 * the dashboard's real shape) and a list-shaped table, which is what most
 * routes resolve into. The minimum height matches the island plus page
 * padding so the scrollbar does not flicker when content lands.
 *
 * Widths are fractions capped at the desktop sizes, so the skeleton never
 * out-grows a phone; the bento is 2 / 4 / 6 columns like the dashboard.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-[calc(100dvh-9.75rem)] animate-fade-in"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-3/5 max-w-52" />
          <Skeleton className="h-3.5 w-4/5 max-w-72" />
        </div>
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4 xl:grid-cols-6">
        <Surface className="col-span-2 flex flex-col justify-between gap-4 p-5 sm:row-span-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-3/5 max-w-36" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </Surface>
        {Array.from({ length: 4 }).map((_, i) => (
          <Surface key={i} className="flex h-[104px] flex-col justify-between p-4 xl:col-span-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-full max-w-28" />
          </Surface>
        ))}
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Skeleton className="h-9 w-20 shrink-0" />
        <Skeleton className="h-9 w-full max-w-72" />
        <Skeleton className="ml-auto hidden h-8 w-36 shrink-0 sm:block" />
      </div>

      <Surface className="overflow-hidden">
        <div className="border-b border-border/70 bg-surface-muted/60 px-4 py-3">
          <Skeleton className="h-3 w-1/2" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0 sm:gap-6"
            style={{ opacity: 1 - i * 0.12 }}
          >
            <Skeleton className="h-3.5 w-[28%] max-w-40" />
            <Skeleton className="h-3.5 w-[38%] max-w-56" />
            <Skeleton className="h-3.5 w-[18%] max-w-32" />
            <Skeleton className="ml-auto hidden h-3.5 w-20 sm:block" />
            <Skeleton className="hidden h-5 w-16 rounded-md sm:block" />
          </div>
        ))}
      </Surface>
    </div>
  )
}
