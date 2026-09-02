import { NextResponse } from 'next/server'
import { z } from 'zod'
import { lookup } from 'node:dns/promises'
import { lookup as lookupRueckruf } from 'node:dns'
import { Agent } from 'undici'
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
 * WARUM DIE ROUTE DAS BILD SELBST ABLEGT UND NICHT ZURUECKGIBT: Zurueckgegeben
 * wurde es vorher als base64 in einer JSON-Antwort. Das blaeht um ein Drittel
 * auf, und Vercel begrenzt den Antwortkoerper einer Funktion auf wenige
 * Megabyte — die versprochenen 15 MB waeren im Betrieb bei rund 3 MB
 * gerissen, mit einer Fehlermeldung, die eine falsche Ursache nennt. Lokal
 * waere davon nichts zu sehen gewesen. Jetzt geht das Bild direkt in den
 * Speicher, unter Marks eigener Anmeldung, und zurueck kommt nur die Adresse.
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
const MAX_MB = 15
const MAX_BYTES = MAX_MB * 1024 * 1024
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
  return art === 4 ? istInternesV4(ip) : istInternesV6(ip)
}

function istInternesV4(ip: string): boolean {
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
  if (a === 192 && b === 0) return true           // 192.0.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true // Messnetz
  if (a === 198 && b === 51) return true          // Dokumentation
  if (a === 203 && b === 0) return true           // Dokumentation
  if (a >= 224) return true                      // Multicast und reserviert
  return false
}

/**
 * IPv6 ZAHLENWEISE prüfen, nicht über Zeichenketten.
 *
 * WARUM DAS HIER STEHT UND NICHT EIN PAAR `startsWith`: Genau daran ist diese
 * Wache am 02.09.2026 gescheitert, und der Test hat es nicht gemerkt.
 *
 * `new URL('http://[::ffff:127.0.0.1]/')` liefert als Hostnamen NICHT die
 * punktierte Form zurück, sondern die normalisierte Hexform `::ffff:7f00:1`.
 * Die alte Prüfung suchte per Regex nach `::ffff:\d+.\d+.\d+.\d+` — das traf
 * nie zu. Die Adresse fiel durch alle Zweige und galt als erlaubt: ein offener
 * Weg auf 127.0.0.1, also auf Marks Proxy samt Schlüssel. Der Test war grün,
 * weil er die punktierte Form prüfte — die Schreibweise, die im Betrieb gar
 * nicht ankommt. Eine Messung, die am gemeinten Wert vorbeigeht, ist gefährlicher
 * als keine: Sie erzeugt Vertrauen.
 *
 * Deshalb wird die Adresse jetzt in acht Gruppen zerlegt und gerechnet. Jede
 * Form, die eine IPv4 in sich trägt, wird ausgepackt und mit derselben
 * IPv4-Prüfung behandelt.
 */
function istInternesV6(ip: string): boolean {
  const gruppen = v6Gruppen(ip.split('%')[0] ?? '')
  if (!gruppen) return true  // nicht zerlegbar → nicht erlauben

  const [g0, g1, g2, g3, g4, g5, g6, g7] = gruppen
  const alleNull = gruppen.every(g => g === 0)
  if (alleNull) return true                       // ::
  if (gruppen.slice(0, 7).every(g => g === 0) && g7 === 1) return true  // ::1

  // In IPv6 verpackte IPv4 — mit derselben Elle messen wie eine echte IPv4.
  const eingebettet = (): string => `${g6! >> 8}.${g6! & 0xff}.${g7! >> 8}.${g7! & 0xff}`
  const ersteFuenfNull = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0
  if (ersteFuenfNull && g5 === 0xffff) return istInternesV4(eingebettet())  // ::ffff:0:0/96
  if (ersteFuenfNull && g5 === 0) return true      // ::x.x.x.x, veraltet — gar nicht erst
  if (g0 === 0x0064 && g1 === 0xff9b) return istInternesV4(eingebettet())  // NAT64

  // 6to4 und Teredo tragen ebenfalls eine IPv4 in sich und koennen ueber
  // Vermittler in fremde Netze reichen. Fuer ein Referenzbild braucht das
  // niemand — pauschal nein ist hier die richtige Antwort.
  if (g0 === 0x2002) return true                   // 6to4
  if (g0 === 0x2001 && g1 === 0x0000) return true  // Teredo

  if ((g0! & 0xfe00) === 0xfc00) return true       // fc00::/7 eindeutig lokal
  if ((g0! & 0xffc0) === 0xfe80) return true       // fe80::/10 Link-Local
  if ((g0! & 0xff00) === 0xff00) return true       // ff00::/8 Multicast
  return false
}

/** Eine IPv6-Adresse in acht 16-Bit-Gruppen zerlegen. `null`, wenn sie nicht aufgeht. */
function v6Gruppen(ip: string): number[] | null {
  if (ip.length === 0) return null
  // Eine angehaengte IPv4 (`::ffff:127.0.0.1`) zuerst in zwei Gruppen wandeln.
  const mitV4 = /^(.*:)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(ip)
  if (mitV4) {
    const t = (mitV4[2] as string).split('.').map(Number)
    if (t.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return null
    const hoch = ((t[0] as number) << 8) | (t[1] as number)
    const tief = ((t[2] as number) << 8) | (t[3] as number)
    ip = `${mitV4[1]}${hoch.toString(16)}:${tief.toString(16)}`
  }

  const haelften = ip.split('::')
  if (haelften.length > 2) return null
  const teile = (t: string): number[] =>
    t.length === 0 ? [] : t.split(':').map(x => (/^[0-9a-f]{1,4}$/i.test(x) ? parseInt(x, 16) : -1))

  const links = teile(haelften[0] ?? '')
  const rechts = haelften.length === 2 ? teile(haelften[1] ?? '') : []
  if ([...links, ...rechts].some(n => n < 0)) return null

  if (haelften.length === 1) return links.length === 8 ? links : null
  const fehlend = 8 - links.length - rechts.length
  if (fehlend < 1) return null
  return [...links, ...Array(fehlend).fill(0), ...rechts]
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

/**
 * Ein Vermittler, der die Adresse NOCH EINMAL prüft — beim Verbinden.
 *
 * WARUM: Zwischen unserer Prüfung und dem Abruf fragt `fetch` den Namensdienst
 * selbst noch einmal. Ein Name mit Lebensdauer 0, der beim ersten Mal eine
 * öffentliche und beim zweiten Mal 127.0.0.1 liefert, käme sonst durch — das
 * heisst DNS-Rebinding. Geprüft würde die eine Auflösung, benutzt die andere.
 *
 * Hier hängt die Prüfung an derselben Auflösung, mit der auch verbunden wird.
 * Damit gibt es kein Zeitfenster mehr dazwischen.
 */
const VERMITTLER = new Agent({
  connect: {
    lookup(hostname, optionen, fertig) {
      lookupRueckruf(hostname, { ...optionen, all: true }, (fehler, adressen) => {
        if (fehler) return fertig(fehler, '', 4)
        const liste = adressen as unknown as { address: string; family: number }[]
        const sauber = liste.filter(a => !istInternesZiel(a.address))
        if (sauber.length === 0) {
          return fertig(new Error('Diese Adresse zeigt ins interne Netz.'), '', 4)
        }
        // Nur die geprüften weiterreichen — verbunden wird auf keine andere.
        const erste = sauber[0] as { address: string; family: number }
        fertig(null, optionen.all ? (sauber as never) : (erste.address as never), erste.family)
      })
    },
  },
})

class Fehler extends Error {
  constructor(public status: number, nachricht: string) { super(nachricht) }
}

/**
 * Den Koerper lesen und dabei MITZAEHLEN.
 *
 * `arrayBuffer()` haette alles erst geholt und danach gemessen: Ein Server, der
 * zwei Gigabyte schickt, haette die Funktion umgebracht, bevor die Grenze
 * ueberhaupt zur Sprache kommt. Und die Meldung „mehr als 15 MB werden nicht
 * geholt" waere obendrein falsch gewesen — geholt waren sie ja.
 */
async function imFlussLesen(antwort: Response): Promise<Blob> {
  const leser = antwort.body?.getReader()
  if (!leser) throw new Fehler(502, 'Unter dieser Adresse kam nichts an.')
  const stuecke: Uint8Array[] = []
  let gesamt = 0
  for (;;) {
    const { done, value } = await leser.read()
    if (done) break
    if (!value) continue
    gesamt += value.byteLength
    if (gesamt > MAX_BYTES) {
      await leser.cancel()
      throw new Fehler(413, `Das Bild ist größer als ${MAX_MB} MB — so viel wird nicht geholt.`)
    }
    stuecke.push(value)
  }
  if (gesamt === 0) throw new Fehler(502, 'Unter dieser Adresse kamen null Bytes an.')
  return new Blob(stuecke as BlobPart[])
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

    // EINE Frist fuer den ganzen Vorgang, nicht je Sprung: Vier Spruenge mal
    // zwanzig Sekunden waeren achtzig, und dann bricht die Plattform vorher ab
    // — Mark saehe einen Plattformfehler statt eines verstaendlichen Satzes.
    const frist = AbortSignal.timeout(FRIST_MS)

    // Weiterleitungen von Hand: Jeder Sprung wird einzeln geprüft. Mit
    // `redirect: 'follow'` liefe der letzte Sprung ungeprüft.
    let ziel = await zielPruefen(rumpf.url)
    let antwort: Response | null = null
    for (let sprung = 0; sprung <= MAX_SPRUENGE; sprung++) {
      antwort = await fetch(ziel, {
        redirect: 'manual',
        signal: frist,
        dispatcher: VERMITTLER,
        headers: {
          // Manche Bilddienste liefern ohne Accept eine HTML-Seite aus.
          Accept: 'image/*,*/*;q=0.8',
          'User-Agent': 'PromptTresor/1.0 (Referenzbild)',
        },
      } as RequestInit & { dispatcher: unknown })
      if (antwort.status < 300 || antwort.status >= 400) break
      const weiter = antwort.headers.get('location')
      if (!weiter) break
      if (sprung === MAX_SPRUENGE) {
        throw new Fehler(502, 'Die Adresse leitet zu oft weiter.')
      }
      ziel = await zielPruefen(new URL(weiter, ziel).toString())
    }

    if (!antwort || !antwort.ok) {
      // Der Status steht hier bewusst noch drin: Er hilft Mark („404 — das Bild
      // ist weg"), und der Zielrechner ist ohnehin einer, den er selbst
      // ausgewaehlt hat. Die ROHE Netzwerkmeldung unten dagegen nicht mehr —
      // aus „Verbindung abgelehnt" gegen „Zeitueberschreitung" liesse sich
      // ablesen, welche Tueren im fremden Netz offen stehen.
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
      throw new Fehler(413, `Das Bild ist ${Math.round(gemeldet / 1024 / 1024)} MB groß — mehr als ${MAX_MB} MB werden nicht geholt.`)
    }
    const daten = await imFlussLesen(antwort)

    const sauberTyp = typ.split(';')[0]?.trim() ?? 'image/png'
    // Direkt in den Speicher, MIT Marks eigener Anmeldung — die Schreibregel
    // prüft `storage.foldername(name)[1] = auth.uid()` und lässt genau diesen
    // einen Ordner zu.
    const pfad = `${user.id}/referenzen/${crypto.randomUUID()}.${endungFuer(typ)}`
    const { error: hochErr } = await supabase.storage
      .from('generated-images')
      .upload(pfad, daten, { contentType: sauberTyp, upsert: false })
    if (hochErr) {
      throw new Fehler(502, `Das Bild ließ sich nicht ablegen: ${hochErr.message}`)
    }
    const { data: { publicUrl } } = supabase.storage.from('generated-images').getPublicUrl(pfad)

    return NextResponse.json({ pfad, url: publicUrl, typ: sauberTyp, groesse: daten.size })
  } catch (e) {
    if (e instanceof Fehler) {
      return NextResponse.json({ fehler: e.message }, { status: e.status })
    }
    const m = (e as Error).name === 'TimeoutError'
      ? 'Die Seite hat zu lange gebraucht.'
      : 'Das Bild ließ sich von dieser Adresse nicht holen.'
    return NextResponse.json({ fehler: m }, { status: 502 })
  }
}
