import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

function looksLikeUrl(s: string): boolean {
  if (!s.trim()) return false
  try { new URL(s.trim()); return true } catch { return false }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const IMAGE_MAX_BYTES = 20 * 1024 * 1024

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // 303, nicht der Vorgabewert 307: Das Share-Target liefert einen POST, und
    // 307 erhält die Methode — der Browser würde /login?from=share erneut per
    // POST anfordern und eine 405 bekommen. 303 erzwingt GET.
    return NextResponse.redirect(new URL('/login?from=share', request.url), 303)
  }

  // Der Proxy laesst /api/share bewusst durch, damit die Route selbst mit 303
  // umleiten kann. Damit greift hier aber auch seine zweite Schranke nicht mehr
  // — die Freigabeliste. Sie wird deshalb nachgebildet.
  const allowedEmail = process.env.ALLOWED_EMAIL
  if (allowedEmail && user.email !== allowedEmail) {
    return NextResponse.redirect(new URL('/login?error=not_allowed', request.url), 303)
  }

  // Ein Teilen-Vorgang kommt vom Geraet des Nutzers, nie von einer fremden
  // Seite. Ohne diese Pruefung koennte ein fremdes Formular Bilder in den
  // eigenen Speicher hochladen — die Sitzungscookies gehen bei einem
  // Seitenwechsel mit.
  const herkunft = request.headers.get('origin')
  if (herkunft && new URL(request.url).origin !== herkunft) {
    return NextResponse.redirect(new URL('/', request.url), 303)
  }

  const formData = await request.formData()
  const text = (formData.get('text') as string | null) ?? ''
  const url = (formData.get('url') as string | null) ?? ''
  const title = (formData.get('title') as string | null) ?? ''
  const images = formData.getAll('images').filter((f): f is File => f instanceof File)

  // Same URL-deduplication logic as share-handler.tsx
  const textIsUrl = looksLikeUrl(text.trim())
  const effectiveContent = textIsUrl ? '' : text
  const effectiveUrl = url.trim() || (textIsUrl ? text.trim() : '')
  const effectiveTitle = looksLikeUrl(title.trim()) ? null : (title || null)

  // Upload valid images to Supabase storage
  const mediaUrls: string[] = []
  for (const image of images) {
    if (!ALLOWED_IMAGE_TYPES.includes(image.type)) continue
    if (image.size > IMAGE_MAX_BYTES) continue

    const ext = image.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `${user.id}/shared/${crypto.randomUUID()}.${ext}`
    const bytes = new Uint8Array(await image.arrayBuffer())

    const { error } = await supabase.storage
      .from('prompt-media')
      .upload(path, bytes, { contentType: image.type })

    if (!error) {
      const { data: { publicUrl } } = supabase.storage
        .from('prompt-media')
        .getPublicUrl(path)
      mediaUrls.push(publicUrl)
    }
  }

  const payload = {
    content: effectiveContent,
    source_url: effectiveUrl || null,
    title: effectiveTitle,
    media_urls: mediaUrls,
  }

  // 303 wie oben — der Service Worker macht es in public/sw.js:85 bereits richtig.
  // Ohne aktiven Service Worker (erster Start der installierten App, abgemeldeter
  // SW) lief dieser Weg mit 307 ins Leere.
  const response = NextResponse.redirect(new URL('/?from=share', request.url), 303)
  response.cookies.set('pending_share', JSON.stringify(payload), {
    httpOnly: false,
    maxAge: 60,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  })

  return response
}
