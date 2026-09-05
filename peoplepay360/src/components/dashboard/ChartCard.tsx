import { Surface } from "@/components/ui/surface"

function CardHeader({ title, source }: { title: string; source: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      <p className="text-[11px] text-subtle-foreground">Source · {source}</p>
    </div>
  )
}

export function ChartCard({
  title,
  source,
  children,
}: {
  title: string
  source: string
  children: React.ReactNode
}) {
  return (
    <Surface padded className="min-w-0">
      <CardHeader title={title} source={source} />
      <div className="h-64">{children}</div>
    </Surface>
  )
}

export function PanelCard({
  title,
  source,
  children,
}: {
  title: string
  source: string
  children: React.ReactNode
}) {
  return (
    <Surface padded className="min-w-0">
      <CardHeader title={title} source={source} />
      {children}
    </Surface>
  )
}
