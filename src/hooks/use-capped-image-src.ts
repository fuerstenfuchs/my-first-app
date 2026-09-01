'use client'

import { useEffect, useState } from 'react'
import { capImageDimensions } from '@/lib/utils'

const blobCache = new Map<string, string>()

// Returns an <img> src that is guaranteed to be reasonably small, so native browser
// drag-out doesn't silently fail on large images. CDN-resizable URLs (Shopify
// width/height, Scene7 wid) are capped synchronously via query params. Everything
// else — most importantly our own Supabase Storage uploads, which have no resize
// service — is downscaled client-side via canvas into a cached blob URL.
export function useCappedImageSrc(url: string, maxDim = 800): string {
  const capped = capImageDimensions(url, maxDim)
  const needsCanvasFallback = capped === url
  const [src, setSrc] = useState(() => needsCanvasFallback ? (blobCache.get(url) ?? url) : capped)

  useEffect(() => {
    if (!needsCanvasFallback) { setSrc(capped); return }
    const cached = blobCache.get(url)
    if (cached) { setSrc(cached); return }

    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const { naturalWidth: w, naturalHeight: h } = img
      if (!w || !h || (w <= maxDim && h <= maxDim)) return
      try {
        const scale = maxDim / Math.max(w, h)
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          if (!blob || cancelled) return
          const blobUrl = URL.createObjectURL(blob)
          blobCache.set(url, blobUrl)
          setSrc(blobUrl)
        }, 'image/jpeg', 0.85)
      } catch {
        // tainted canvas (CORS) or other failure — keep the original url
      }
    }
    img.src = url
    return () => { cancelled = true }
  }, [url, maxDim, needsCanvasFallback, capped])

  return src
}
