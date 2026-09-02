import { NextResponse } from 'next/server'
import { z } from 'zod'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { createClient } from '@/lib/supabase-server'

/**
 * Ein Bild von einer fremden Adresse holen — für „von einer Webseite hineinziehen".
 *
 * WARUM DAS NICHT DER BROWSER MACHT: Zieht man ein Bild aus einer Webseite in
 * unsere Seite, kommt keine Datei an, sondern nur die Adresse. Ein `fetch`
 * darauf scheitert bei so gut wie jeder fremden Domain an CORS — der Browser
 * bekommt die Bytes nicht zu sehen. Der Server hat diese Schranke nicht.
 *
 * WARUM DIESE ROUTE TROTZDEM VORSICHTIG SEIN MUSS: Sie holt eine Adresse, die
 * von außen kommt. Ohne Prüfung wäre das ein Weg, den Server für sich sprechen
 * zu lassen — auf `http://127.0.0.1:8317` (Marks Proxy), auf `169.254.169.254`
 * (die Metadatenadresse von Cloud-Anbietern, klassischer Schlüsseldiebstahl)
 * oder auf irgendeine Maschine im selben Netz, die von außen nicht erreichbar
 * ist. Das nennt sich SSRF, und es ist der Grund für fast alles hier unten.
 *
 * Die Wache greift an drei Stellen, weil eine nicht reicht:
 *  1. Nur http und https. Kein `file:`, kein `data:`, kein `gopher:`.
 *  2. Der Name wird AUFGELÖST und die Adresse geprüft. Ein Hostname wie
 *     `localtest.me` zeigt auf 127.0.0.1 — dem Namen sieht man das nicht an.
 *  3. Jede Weiterleitung wird einzeln geprüft. Eine harmlose Adresse, die auf
 *     das interne Netz weiterleitet, wäre sonst die offene Tür.
 */

export const runtime = 'nodejs'

/** Höchstens so groß — ein Referenzbild, kein Filmdownload. */
const MAX_BYTES = 15 * 1024 * 1024
/** Wie viele Weiterleitungen mitgegangen werden. Drei reichen für jeden Bilddienst. */
const MAX_SPRUENGE = 3
const FRIST_MS = 20_000

/**
 * Zeigt diese IP-Adresse irgendwohin, wo sie nicht hinzeigen darf?
 *
 * Erfasst Schleife, privates Netz, Link-Local (dort liegt die Metadatenadresse
 * der Cloud-Anbieter), Carrier-NAT, Multicast und die für IPv6 entsprechenden
 * Bereiche. Ein in IPv6 eingebettetes IPv4 (`::ffff:127.0.0.1`) wird
 * ausgepackt, sonst wäre es eine Lücke.
 */
export function istInternesZiel(ip: string): boolean {
  const art = isIP(ip)
  if (art === 0) return true // nicht deutbar → nicht erlauben

  if (art === 4) {
    const t = ip.split('.').map(Number)
    if (t.length !== 4 || t.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true
    const [a, b] = t as [number, number, number, number]
    if (a === 0) return true                       // 0.0.0.0/8
    if (a === 10) return true                      // privat
    if (a === 127) return true                     // Schleife
    if (a === 169 && b === 254) return true        // Link-Local, Cloud-Metadaten
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 100 && b >= 64 && b <= 127) return true  // Carrier-NAT
    if (a === 192 && b === 0) return true           // 192.0.0.0/24 und Doku-Netze
    if (a >= 224) return true                      // Multicast und reserviert
    return false
  }

  const v6 = ip.toLowerCase().split('%')[0] ?? ''
  // In IPv6 verpacktes IPv4 auspacken — sonst schlüpft ::ffff:127.0.0.1 durch.
  const eingebettet = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6)
  if (eingebettet) return istInternesZiel(eingebettet[1] as string)
  if (v6 === '::' || v6 === '::1') return true
  if (v6.startsWith('fc') || v6.startsWith('fd')) return true  // eindeutig lokal
  if (v6.startsWith('fe8') || v6.startsWith('fe9') ||
      v6.startsWith('fea') || v6.startsWith('feb')) return true // Link-Local
  if (v6.startsWith('ff')) return true                          // Multicast
  return false
}

/** Adresse prüfen und dabei den Namen auflösen. Wirft mit einem Satz für Mark. */
async function zielPruefen(roh: string): Promise<URL> {
  let u: URL
  try {
    u = new URL(roh)
  } catch {
    throw new Fehler(400, 'Das war keine gültige Bildadresse.')
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Fehler(400, `Adressen der Art „${u.protocol}" werden nicht geholt — nur http und https.`)
  }

  // Der Hostname kann selbst schon eine IP sein; dann gar nicht erst auflösen.
  const alsIp = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(alsIp)) {
    if (istInternesZiel(alsIp)) {
      throw new Fehler(400, 'Diese Adresse zeigt ins interne Netz — von dort wird nichts geholt.')
    }
    return u
  }

  let adressen: { address: string }[]
  try {
    adressen = await lookup(u.hostname, { all: true })
  } catch {
    throw new Fehler(400, `Der Rechnername „${u.hostname}" ließ sich nicht auflösen.`)
  }
  // ALLE Antworten müssen sauber sein, nicht nur die erste: Ein Name kann
  // mehrere Adressen tragen, und welche davon benutzt wird, entscheidet nicht
  // diese Zeile.
  if (adressen.length === 0 || adressen.some(a => istInternesZiel(a.address))) {
    throw new Fehler(400, 'Diese Adresse zeigt ins interne Netz — von dort wird nichts geholt.')
  }
  return u
}

class Fehler extends Error {
  constructor(public status: number, nachricht: string) { super(nachricht) }
}

/** Endung aus dem gemeldeten Typ — für einen lesbaren Dateinamen. */
function endungFuer(typ: string): string {
  const t = typ.split(';')[0]?.trim().toLowerCase() ?? ''
  const tabelle: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif',
  }
  return tabelle[t] ?? 'png'
}

/** Was hereinkommen darf. Die inhaltliche Pruefung macht danach `zielPruefen`. */
const EINGABE = z.object({ url: z.string().min(1).max(4096) })

export async function POST(anfrage: Request) {
  try {
    // Angemeldet sein muss man: Diese Route holt im Namen des Servers Daten aus
    // dem Netz. Offen im Netz wäre sie ein Umleiter für beliebige Dritte.
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ fehler: 'Nicht angemeldet.' }, { status: 401 })

    let roh: unknown
    try { roh = await anfrage.json() } catch { roh = null }
    const geprueft = EINGABE.safeParse(roh)
    if (!geprueft.success) {
      return NextResponse.json({ fehler: 'Es kam keine gültige Bildadresse an.' }, { status: 400 })
    }
    const rumpf = geprueft.data

    // Weiterleitungen von Hand: Jeder Sprung wird einzeln geprüft. Mit
    // `redirect: 'follow'` liefe der letzte Sprung ungeprüft.
    let ziel = await zielPruefen(rumpf.url)
    let antwort: Response | null = null
    for (let sprung = 0; sprung <= MAX_SPRUENGE; sprung++) {
      antwort = await fetch(ziel, {
        redirect: 'manual',
        signal: AbortSignal.timeout(FRIST_MS),
        headers: {
          // Manche Bilddienste liefern ohne Accept eine HTML-Seite aus.
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'PromptTresor/1.0 (Referenzbild)',
        },
      })
      if (antwort.status < 300 || antwort.status >= 400) break
      const weiter = antwort.headers.get('location')
      if (!weiter) break
      if (sprung === MAX_SPRUENGE) {
        throw new Fehler(502, 'Die Adresse leitet zu oft weiter.')
      }
      ziel = await zielPruefen(new URL(weiter, ziel).toString())
    }

    if (!antwort || !antwort.ok) {
      throw new Fehler(502, `Die Seite antwortete mit ${antwort?.status ?? 'nichts'} — das Bild kam nicht an.`)
    }

    const typ = antwort.headers.get('content-type') ?? ''
    if (!typ.toLowerCase().startsWith('image/')) {
      throw new Fehler(415, 'Unter dieser Adresse liegt kein Bild, sondern ' +
        `„${typ.split(';')[0] || 'etwas Unbekanntes'}".`)
    }
    // Erst der gemeldeten Länge glauben, danach der tatsächlichen: Die Angabe
    // im Kopf kann fehlen oder lügen.
    const gemeldet = Number(antwort.headers.get('content-length') ?? '0')
    if (gemeldet > MAX_BYTES) {
      throw new Fehler(413, `Das Bild ist ${Math.round(gemeldet / 1024 / 1024)} MB groß — mehr als 15 MB werden nicht geholt.`)
    }
    const daten = await antwort.arrayBuffer()
    if (daten.byteLength > MAX_BYTES) {
      throw new Fehler(413, `Das Bild ist ${Math.round(daten.byteLength / 1024 / 1024)} MB groß — mehr als 15 MB werden nicht geholt.`)
    }
    if (daten.byteLength === 0) {
      throw new Fehler(502, 'Unter dieser Adresse kamen null Bytes an.')
    }

    const endung = endungFuer(typ)
    const ausPfad = ziel.pathname.split('/').pop() ?? ''
    const name = /\.[a-z0-9]{2,5}$/i.test(ausPfad) ? ausPfad : `referenz.${endung}`

    return NextResponse.json({
      datenBase64: Buffer.from(daten).toString('base64'),
      typ: typ.split(';')[0]?.trim() ?? 'image/png',
      name,
    })
  } catch (e) {
    if (e instanceof Fehler) {
      return NextResponse.json({ fehler: e.message }, { status: e.status })
    }
    const m = (e as Error).name === 'TimeoutError'
      ? 'Die Seite hat zu lange gebraucht.'
      : `Das Bild ließ sich nicht holen: ${(e as Error).message}`
    return NextResponse.json({ fehler: m }, { status: 502 })
  }
}
