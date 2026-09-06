import { Skeleton } from "@/components/ui/skeleton"
import { Surface } from "@/components/ui/surface"

/**
 * Route-level skeleton. Header, a bento row (one wide block, four tiles —
 * the dashboard's real shape) and a list-shaped table, which is what most
 * routes resolve into. The minimum height matches the island plus page
 * padding so the scrollbar does not flicker when content lands.
 */
export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="min-h-[calc(100dvh-9.75rem)] animate-fade-in"
    >
      <div className="mb-5 flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      <div className="mb-5 grid grid-cols-6 gap-4">
        <Surface className="col-span-2 row-span-2 flex flex-col justify-between p-5">
          <div className="space-y-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-36" />
          </div>
          <Skeleton className="h-20 w-full rounded-xl" />
        </Surface>
        {Array.from({ length: 4 }).map((_, i) => (
          <Surface key={i} className="col-span-2 flex h-[104px] flex-col justify-between p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-28" />
          </Surface>
        ))}
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
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-6 border-b border-border/60 px-4 py-3.5 last:border-0"
            style={{ opacity: 1 - i * 0.12 }}
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
