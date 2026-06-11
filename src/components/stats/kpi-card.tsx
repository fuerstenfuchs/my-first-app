import { Card, CardContent } from '@/components/ui/card'

interface KpiCardProps {
  label: string
  value: string | number
  icon?: React.ReactNode
}

export function KpiCard({ label, value, icon }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          </div>
          {icon && (
            <div className="text-muted-foreground mt-0.5">{icon}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
