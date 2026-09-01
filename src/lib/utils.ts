import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Caps width/height query params (e.g. Shopify CDN resize service) so thumbnail grids
// request a smaller image. Very large images can silently fail to start a native
// browser drag-out, so this keeps the dragged payload small without affecting how
// the thumbnail looks (it's rendered tiny anyway).
export function capImageDimensions(url: string, maxDim = 800): string {
  // Shopify-style explicit width/height params — edited via regex so we don't
  // re-encode (and risk corrupting) other CDNs' special query syntax below.
  const widthMatch = url.match(/([?&])width=(\d+)/)
  const heightMatch = url.match(/([?&])height=(\d+)/)
  if (widthMatch && heightMatch) {
    const w = parseInt(widthMatch[2], 10)
    const h = parseInt(heightMatch[2], 10)
    if (!w || !h || (w <= maxDim && h <= maxDim)) return url
    const scale = maxDim / Math.max(w, h)
    return url
      .replace(/([?&])width=\d+/, `$1width=${Math.round(w * scale)}`)
      .replace(/([?&])height=\d+/, `$1height=${Math.round(h * scale)}`)
  }

  // Adobe Scene7 / Dynamic Media (e.g. *.scene7.com) uses a different syntax —
  // named presets like "$main@2x$" instead of width=/height= params — so it adds
  // its own "wid" param as a plain string instead of via URLSearchParams, which
  // would percent-encode "$" / "@" and break the preset token.
  if (/scene7\.com/.test(url)) {
    const widMatch = url.match(/[?&]wid=(\d+)/)
    if (widMatch && parseInt(widMatch[1], 10) <= maxDim) return url
    const withoutWid = url.replace(/([?&])wid=\d+/, '').replace(/([?&])hei=\d+/, '')
    const separator = withoutWid.includes('?') ? '&' : '?'
    return `${withoutWid}${separator}wid=${maxDim}`
  }

  return url
}
