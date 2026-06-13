const SHARE_CACHE = 'pending-share-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)

  // Intercept the Web Share Target POST — handle entirely in the SW
  // so Next.js never sees it (avoids "Server Action Not Found" routing issue)
  if (event.request.method === 'POST' && url.pathname === '/api/share') {
    event.respondWith(handleShareTarget(event.request))
    return
  }

  // Serve cached share data (images + payload) back to the app
  if (event.request.method === 'GET' && url.pathname.startsWith('/__share-')) {
    event.respondWith(
      caches.open(SHARE_CACHE)
        .then(cache => cache.match(url.pathname))
        .then(r => r ?? new Response(null, { status: 404 }))
    )
    return
  }
  // All other requests: fall through to network (no SW interference)
})

async function handleShareTarget(request) {
  function looksLikeUrl(s) {
    if (!s.trim()) return false
    try { new URL(s.trim()); return true } catch { return false }
  }

  try {
    const formData = await request.formData()

    const text  = String(formData.get('text')  ?? '')
    const url   = String(formData.get('url')   ?? '')
    const title = String(formData.get('title') ?? '')
    const images = formData.getAll('images').filter(f => f instanceof File)

    // Same URL-dedup logic used in share-handler.tsx
    const textIsUrl = looksLikeUrl(text.trim())
    const effectiveContent = textIsUrl ? '' : text
    const effectiveUrl     = url.trim() || (textIsUrl ? text.trim() : '')
    const effectiveTitle   = looksLikeUrl(title.trim()) ? null : (title || null)

    const cache = await caches.open(SHARE_CACHE)

    // Clear any leftover data from a previous share
    const oldKeys = await cache.keys()
    await Promise.all(oldKeys.map(k => cache.delete(k)))

    // Cache each image file so the app can read it as a Blob
    for (let i = 0; i < images.length; i++) {
      const img = images[i]
      await cache.put(
        `/__share-image-${i}`,
        new Response(img, {
          headers: {
            'Content-Type': img.type || 'image/jpeg',
            'X-Filename':   img.name || `image-${i}.jpg`,
          },
        })
      )
    }

    // Cache the text payload
    const payload = {
      content:     effectiveContent,
      source_url:  effectiveUrl || null,
      title:       effectiveTitle,
      image_count: images.length,
    }
    await cache.put(
      '/__share-payload',
      new Response(JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
      })
    )
  } catch {
    // On any error, still redirect — app opens without prefilled content
  }

  return Response.redirect('/?from=share', 303)
}
