'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface Props {
  label:       string
  value:       string
  onChange:    (value: string) => void
  options:     string[]
  allowCustom?: boolean
  multi?:      boolean
}

export function AttributeField({ label, value, onChange, options, allowCustom = false, multi = false }: Props) {
  const selected = multi ? value.split(',').map(s => s.trim()).filter(Boolean) : (value ? [value] : [])
  const customValues = selected.filter(s => !options.includes(s))

  const [customOpen, setCustomOpen] = useState(false)
  const [customDraft, setCustomDraft] = useState('')

  function toggleOption(opt: string) {
    if (multi) {
      const next = selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]
      onChange(next.join(', '))
    } else {
      onChange(value === opt ? '' : opt)
      setCustomOpen(false)
    }
  }

  function addCustom() {
    const v = customDraft.trim()
    if (!v) return
    if (multi) {
      if (!selected.includes(v)) onChange([...selected, v].join(', '))
    } else {
      onChange(v)
      setCustomOpen(false)
    }
    setCustomDraft('')
  }

  function removeCustom(v: string) {
    onChange(multi ? selected.filter(s => s !== v).join(', ') : '')
  }

  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-muted-foreground font-normal">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {options.map(opt => {
          const isActive = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleOption(opt)}
              className={cn(
                'px-2 py-1 rounded-md border text-[11px] transition-colors',
                isActive
                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                  : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              {opt}
            </button>
          )
        })}
        {customValues.map(v => (
          <button
            key={v}
            type="button"
            onClick={() => removeCustom(v)}
            title="Entfernen"
            className="px-2 py-1 rounded-md border border-amber-500/50 bg-amber-500/10 text-amber-300 text-[11px]"
          >
            {v} ✕
          </button>
        ))}
        {allowCustom && (
          <button
            type="button"
            onClick={() => setCustomOpen(v => !v)}
            className={cn(
              'px-2 py-1 rounded-md border border-dashed text-[11px] transition-colors',
              customOpen ? 'border-amber-500/50 text-amber-300' : 'border-border/50 text-muted-foreground hover:border-border hover:text-foreground'
            )}
          >
            + Eigene
          </button>
        )}
      </div>
      {allowCustom && customOpen && (
        <div className="flex gap-1.5 pt-0.5">
          <Input
            value={customDraft}
            onChange={e => setCustomDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
            placeholder="Eigener Wert…"
            className="h-7 text-xs flex-1"
            autoFocus
          />
          <button type="button" onClick={addCustom} className="text-[11px] text-teal-400 hover:text-teal-300 shrink-0 px-1">
            Hinzufügen
          </button>
        </div>
      )}
    </div>
  )
}
