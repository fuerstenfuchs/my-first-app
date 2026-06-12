'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { SharePayload } from '@/components/prompts/quick-capture-modal'

export const PENDING_SHARE_KEY = 'pending_share_payload'

export function ShareHandler() {
  const searchParams = useSearchParams()

  useEffect(() => {
    async function handleShare() {
      const text = searchParams.get('text') ?? ''
      const url = searchParams.get('url') ?? ''
      const title = searchParams.get('title') ?? ''

      const payload: SharePayload = {
        content: text,
        source_url: url || null,
        title: title || null,
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
