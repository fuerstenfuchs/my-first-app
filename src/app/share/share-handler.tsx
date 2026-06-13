'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { SharePayload } from '@/components/prompts/quick-capture-modal'

export const PENDING_SHARE_KEY = 'pending_share_payload'

function looksLikeUrl(s: string): boolean {
  if (!s.trim()) return false
  try { new URL(s.trim()); return true } catch { return false }
}

export function ShareHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleShare() {
      const text = searchParams.get('text') ?? ''
      const url = searchParams.get('url') ?? ''
      const title = searchParams.get('title') ?? ''

      // Browsers (Chrome/Safari) often set text = url when sharing a page.
      // Detect this so the URL goes into source_url, not the prompt content field.
      const textIsUrl = looksLikeUrl(text.trim())
      const effectiveContent = textIsUrl ? '' : text
      const effectiveUrl = url.trim() || (textIsUrl ? text.trim() : '')
      // Some apps set title to the URL — ignore those too.
      const effectiveTitle = looksLikeUrl(title.trim()) ? null : (title || null)

      const payload: SharePayload = {
        content: effectiveContent,
        source_url: effectiveUrl || null,
        title: effectiveTitle,
      }

      try {
        sessionStorage.setItem(PENDING_SHARE_KEY, JSON.stringify(payload))
      } catch {
        // sessionStorage unavailable — continue without persistence
      }

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      window.location.href = session ? '/?from=share' : '/login?from=share'
    }

    handleShare()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <p className="text-muted-foreground text-sm">Wird verarbeitet…</p>
}
