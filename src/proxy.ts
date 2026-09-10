import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { hiesigerWeg } from '@/lib/weiterleitung'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  // /share is public so ShareHandler can run client-side and redirect to /login?from=share itself
  // /api/share likewise: it is a POST target from the mobile share sheet and checks
  // auth itself (route.ts:12-19), redirecting with 303 so the browser switches to GET.
  // Without this exception the proxy answered first with a 307, which preserves the
  // method — the browser then POSTed to /login and got a 405. The route's own
  // redirect was unreachable dead code.
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth/') ||
    pathname === '/share' ||
    pathname === '/api/share'

  if (!isPublicPath && !user) {
    const url = request.nextUrl.clone()
    /*
      WOHIN ER EIGENTLICH WOLLTE, GEHT NICHT VERLOREN.

      Bis zum 10.09.2026 stand hier `url.search = ''` und sonst nichts. Wer
      abgemeldet war und einen Verweis anklickte, landete nach der Anmeldung
      auf der Startseite — der Rest der Adresse war weg. Das faellt erst auf,
      seit es ueberhaupt Verweise auf einzelne Prompts gibt: Marks KI-Zentrale
      liest den Tresor mit und verweist aus ihrer Suche hierher. Genau der
      Klick, der am haeufigsten aus einem anderen Programm kommt, ist auch der,
      bei dem man am ehesten noch nicht angemeldet ist.

      Auf die Startseite selbst wird nichts gemerkt — dorthin fuehrt die
      Anmeldung ohnehin.
    */
    const wohin = pathname + request.nextUrl.search
    url.pathname = '/login'
    url.search = ''
    if (wohin !== '/' && wohin.length <= 512) url.searchParams.set('weiter', wohin)
    return NextResponse.redirect(url)
  }

  if (user) {
    const allowedEmail = process.env.ALLOWED_EMAIL
    if (allowedEmail && user.email !== allowedEmail) {
      await supabase.auth.signOut()
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.search = ''
      url.searchParams.set('error', 'not_allowed')
      return NextResponse.redirect(url)
    }

    if (pathname === '/login') {
      const url = request.nextUrl.clone()
      /*
        NUR EIN WEG IN DIESEM HAUS — nie eine fremde Adresse.

        `weiter` kommt aus der Adresszeile und ist damit von aussen bestimmbar.
        Ohne Pruefung waere das eine offene Weiterleitung: eine Seite koennte
        `?weiter=https://…` unterschieben, und die Anmeldung schickte Mark
        anschliessend woanders hin — mit dem guten Gefuehl, gerade bei sich
        selbst gewesen zu sein.

        Erlaubt ist deshalb nur, was mit genau EINEM Schraegstrich beginnt.
        `//fremd.de` waere protokollrelativ und ginge nach draussen, ein
        rueckwaerts geneigter Strich taeuscht in manchen Browsern dasselbe vor.
      */
      const weiter = hiesigerWeg(request.nextUrl.searchParams.get('weiter'))
      url.pathname = '/'
      url.search = ''
      if (weiter) {
        const ziel = new URL(weiter, request.nextUrl.origin)
        url.pathname = ziel.pathname
        url.search = ziel.search
      }
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
