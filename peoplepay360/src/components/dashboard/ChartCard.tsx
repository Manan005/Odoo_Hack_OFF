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
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">Source: {source}</p>
      <div className="h-64">{children}</div>
    </div>
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
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mb-3 text-xs text-muted-foreground">Source: {source}</p>
      {children}
    </div>
  )
}
