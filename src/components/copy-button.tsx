'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  text: string
  className?: string
}

export function CopyButton({ text, className }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Kopieren"
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-medium transition-colors shrink-0',
        copied ? 'text-emerald-400' : 'text-muted-foreground hover:text-foreground',
        className
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  )
}
