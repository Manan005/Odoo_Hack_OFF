import type { ReactNode } from "react"
import { Surface } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

function CardHeader({
  title,
  source,
  aside,
}: {
  title: string
  source: string
  aside?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-wrap items-center gap-2">
        {aside}
        <p className="text-[11px] text-subtle-foreground">Source · {source}</p>
      </div>
    </div>
  )
}

export function ChartCard({
  title,
  source,
  aside,
  className,
  bodyClassName = "h-64",
  children,
}: {
  title: string
  source: string
  /** Chips or links that sit between the title and the source caption. */
  aside?: ReactNode
  className?: string
  /** Height of the chart viewport; Recharts fills it. */
  bodyClassName?: string
  children: ReactNode
}) {
  return (
    <Surface padded className={cn("min-w-0", className)}>
      <CardHeader title={title} source={source} aside={aside} />
      <div className={bodyClassName}>{children}</div>
    </Surface>
  )
}

export function PanelCard({
  title,
  source,
  aside,
  className,
  children,
}: {
  title: string
  source: string
  aside?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <Surface padded className={cn("min-w-0", className)}>
      <CardHeader title={title} source={source} aside={aside} />
      {children}
    </Surface>
  )
}
