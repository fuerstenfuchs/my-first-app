'use client'

import { cn } from '@/lib/utils'

/**
 * Schalter „Krea-Gewichte" — nur neben dem lokalen Modell Krea 2.
 *
 * Gewichte je Textschicht aus dem Video (Mark, 03.10.2026): macht Haut kontrastreicher und glänzender und das Gesicht jünger und
 * symmetrischer. Standard: aus.
 */
export function KreaGewichteSchalter({
  value, onChange, className,
}: { value: boolean; onChange: (an: boolean) => void; className?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-[13px]', className)}>
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
        className="h-4 w-4 accent-orange-600"
      />
      Krea-Gewichte
    </label>
  )
}
