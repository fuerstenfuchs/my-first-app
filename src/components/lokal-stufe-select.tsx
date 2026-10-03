'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LOKAL_STUFEN, type LokalStufe } from '@/lib/image-generation'
import { cn } from '@/lib/utils'

/**
 * Auflösungsstufe der lokalen Modelle: 1 MP, 2 MP (Standard) oder 4,7 MP.
 *
 * Wird nur neben einem `lokal:`-Modell gezeigt — bei den Proxy-Modellen gibt es
 * die Stufen nicht. Mark am 03.10.2026: „Diese drei Stufen überall haben."
 */
export function LokalStufeSelect({
  value, onChange, className, contentClassName,
}: {
  value: LokalStufe
  onChange: (s: LokalStufe) => void
  className?: string
  contentClassName?: string
}) {
  return (
    <Select value={value} onValueChange={v => onChange(v as LokalStufe)}>
      <SelectTrigger className={cn('h-9 rounded-[10px] text-sm', className)} aria-label="Auflösung (lokal)">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {LOKAL_STUFEN.map(s => (
          <SelectItem key={s.id} value={s.id} className="text-sm">{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
