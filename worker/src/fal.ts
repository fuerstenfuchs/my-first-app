/**
 * KI-Vergrößerung über fal.ai — SeedVR2 (ByteDance) und Crystal (Clarity AI).
 *
 * Der Unterschied zu `upscale.ts` ist nicht graduell: Lanczos verteilt die
 * vorhandenen Bildpunkte klüger, diese beiden rekonstruieren Struktur, die im
 * Original nicht steht — Hautporen, Haarsträhnen, Stoffgewebe.
 *
 * Lokal betreiben ließe sich SeedVR2 durchaus (Apache 2.0), aber nur mit einer
 * NVIDIA-Karte mit reichlich eigenem Speicher. Dieser PC hat eine integrierte
 * AMD 780M ohne eigenen Videospeicher und kein CUDA (gemessen 02.09.2026) —
 * deshalb der Umweg über eine Gegenstelle.
 *
 * WARUM DER SCHLÜSSEL HIER LIEGT UND NICHT BEI VERCEL: Der Arbeiter läuft auf
 * Marks PC, die App in der Cloud. Läge FAL_KEY in der Vercel-Umgebung, wäre er
 * einem fremden Rechenzentrum anvertraut und stünde jeder Server-Route offen.
 * Hier kennt ihn nur dieser eine Prozess.
 *
 * DIESER WEG KOSTET GELD. Jede Zeile, die einen zweiten Auftrag absenden
 * könnte, ist deshalb eine Zeile, die doppelt zahlt — siehe `merken`.
 */

import { config, ohneGeheimnis } from './config.ts'

const ANMELDEN = 'https://queue.fal.run'

/**
 * Die KI-Verfahren, die es gibt.
 *
 * Sie sprechen nicht dieselbe Sprache: SeedVR2 will `upscale_factor` und gibt
 * `image` zurueck, Crystal will `scale_factor` und gibt `images` als Liste
 * zurueck. Diese Unterschiede gehoeren hierher, an eine Stelle — und nicht als
 * `if` verstreut durch den Ablauf, der fuer beide gleich ist.
 *
 * Warum beide: SeedVR2 rekonstruiert zurueckhaltend und bleibt nah am
 * Original, Crystal geht freier zu Werke. Welches passt, haengt vom Bild ab.
 */
export type KiVerfahren = 'seedvr2' | 'crystal'

type Bildangabe = { url?: string; width?: number; height?: number }

type FalModell = {
  id: string
  rumpf: (bildUrl: string, faktor: number) => Record<string, unknown>
  bildAus: (antwort: Record<string, unknown>) => Bildangabe
}

const MODELLE: Record<KiVerfahren, FalModell> = {
  seedvr2: {
    id: 'fal-ai/seedvr/upscale/image',
    rumpf: (image_url, faktor) => ({
      image_url,
      upscale_mode: 'factor',
      upscale_factor: faktor,
      // PNG, weil die ganze Kette verlustfrei ist. Die Voreinstellung waere bei
      // beiden Modellen JPEG — das wuerde am Ende der Bearbeitung
      // Kompressionsspuren hineintragen, die vorher nicht da waren.
      output_format: 'png',
    }),
    bildAus: a => (a.image ?? {}) as Bildangabe,
  },
  crystal: {
    id: 'fal-ai/crystal-upscaler',
    rumpf: (image_url, faktor) => ({
      image_url,
      scale_factor: faktor,
      output_format: 'png',
      // 0 = nah am Original. Der Regler geht bis 10; hoehere Werte erfinden
      // mehr dazu. Bewusst nicht geraten — wenn Mark mehr will, wird daraus
      // eine Einstellung in der Oberflaeche.
      creativity: 0,
    }),
    bildAus: a => ((a.images as Bildangabe[] | undefined)?.[0] ?? {}) as Bildangabe,
  },
}

/** Abstand zwischen zwei Nachfragen beim laufenden Auftrag. */
const NACHFRAGE_MS = 2000

/**
 * Nur von diesen Adressen wird etwas geholt.
 *
 * Die Adressen kommen aus einer Antwort, also von außen. Ohne diese Prüfung
 * wären sie ein Weg, den Arbeiter beliebige Adressen abrufen zu lassen — auch
 * `127.0.0.1`, wo der Bild-Proxy mitsamt Token lauscht. Dieselbe Schranke steht
 * in `supabase.ts` vor den Referenzbildern, aus demselben Grund.
 */
const ERLAUBTE_HOSTS = ['fal.media', 'v3.fal.media', 'v2.fal.media', 'queue.fal.run', 'fal.run']

export function hostErlaubt(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.protocol !== 'https:') return false
    return ERLAUBTE_HOSTS.some(h => u.hostname === h || u.hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

/**
 * Was von einem abgesendeten Auftrag festgehalten wird.
 *
 * Die Adressen kommen mit und werden nicht selbst zusammengebaut: fal legt
 * Status und Ergebnis unter einem anderen Pfad ab als dem des Modells, und
 * genau daran scheitern Anbindungen regelmäßig.
 */
export type FalAnfrage = {
  request_id?: string
  status_url?: string
  response_url?: string
}

export type KiErgebnis = {
  daten: ArrayBuffer
  nachher: { breite: number; hoehe: number }
  /** true, wenn das Ergebnis eines früheren Versuchs abgeholt wurde. */
  wiederaufgenommen: boolean
}

export type KiOptionen = {
  signal?: AbortSignal
  /**
   * Ein bereits abgesendeter Auftrag aus einem früheren Versuch. Ist er noch
   * abholbar, kostet dieser Durchgang nichts.
   */
  vorhandeneAnfrage?: FalAnfrage | null
  /**
   * Wird unmittelbar nach dem Absenden aufgerufen — VOR dem ersten Warten.
   * Ab diesem Moment ist der Lauf bezahlt, also muss er ab diesem Moment
   * wiederauffindbar sein. Alles andere hieße: bei jedem Fehler noch einmal
   * zahlen.
   */
  merken?: (anfrage: FalAnfrage) => Promise<void>
}

function schluessel(): string {
  if (!config.falKey) {
    throw new Error(
      'Für die KI-Vergrößerung fehlt FAL_KEY in worker/.env. ' +
      'Schlüssel auf fal.ai/dashboard/keys anlegen und dort eintragen.',
    )
  }
  return config.falKey
}

/**
 * Abbruch UND Zeitgrenze, nicht das eine oder das andere.
 *
 * Vorher stand hier `signal ?? AbortSignal.timeout(...)`. Damit fiel die
 * Zeitgrenze genau dann weg, wenn der Dauerbetrieb sein Abbruchsignal mitgab —
 * also im Regelfall. Eine Verbindung, die nie antwortet, hätte den Arbeiter
 * unbegrenzt blockiert: kein Fehler, keine Meldung, nur Stille. Und Stille
 * sieht in diesem Projekt genauso aus wie „nichts zu tun".
 *
 * Die beiden Gründe bleiben unterscheidbar: Abbruch von außen wirft AbortError
 * (index.ts stellt den Auftrag zurück), die Zeitgrenze wirft TimeoutError
 * (zählt als Fehlversuch). Genauso macht es `proxy.ts`.
 */
function mitFrist(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const frist = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, frist]) : frist
}

type Antwort = { status: number; text: string }

async function falRuf(
  url: string, init: RequestInit, signal?: AbortSignal,
): Promise<Antwort> {
  try {
    const antwort = await fetch(url, {
      ...init,
      headers: { Authorization: `Key ${schluessel()}`, ...(init.headers ?? {}) },
      signal: mitFrist(signal, 60_000),
    })
    return { status: antwort.status, text: await antwort.text() }
  } catch (e) {
    throw uebersetzeFehler(e as Error, signal, 60_000)
  }
}

/**
 * Netzfehler in etwas übersetzen, das der Aufrufer unterscheiden kann.
 *
 * Wichtig ist der letzte Fall: Trifft der Abbruch, während der Antwortrumpf
 * gelesen wird, wirft undici einen TypeError („terminated") statt eines
 * AbortError. `index.ts` erkennt den nicht — der Auftrag würde als
 * fehlgeschlagen gelten statt zurückgestellt zu werden, und das kostet bei
 * einem bezahlten Auftrag einen zusätzlichen bezahlten Neuversuch.
 */
function uebersetzeFehler(fehler: Error, signal: AbortSignal | undefined, ms: number): Error {
  if (fehler.name === 'TimeoutError') {
    return new Error(`fal.ai hat nach ${Math.round(ms / 1000)}s nicht geantwortet.`)
  }
  if (fehler.name === 'AbortError') return fehler
  if (signal?.aborted) return new DOMException('Abgebrochen', 'AbortError')
  return new Error(ohneGeheimnis(`fal.ai nicht erreichbar: ${fehler.message}`))
}

function alsJson(antwort: Antwort, was: string): Record<string, unknown> {
  if (antwort.status >= 400) {
    // Der Text der Gegenstelle bleibt drin — er nennt bei fal den Grund
    // (fehlendes Guthaben, zu großes Bild) und ohne ihn stünde hier nur
    // eine Zahl.
    throw new Error(ohneGeheimnis(
      `fal.ai ${was} → HTTP ${antwort.status}: ${antwort.text.slice(0, 400)}`,
    ))
  }
  try {
    return JSON.parse(antwort.text) as Record<string, unknown>
  } catch {
    throw new Error(`fal.ai ${was} hat keine lesbare Antwort geliefert.`)
  }
}

/** Auftrag absenden. Ab hier kostet es Geld. */
async function absenden(
  quelle: ArrayBuffer, faktor: number, modell: FalModell, signal?: AbortSignal,
): Promise<FalAnfrage> {
  const bild = `data:image/png;base64,${Buffer.from(quelle).toString('base64')}`

  const roh = await falRuf(`${ANMELDEN}/${modell.id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modell.rumpf(bild, faktor)),
    signal,
  }, signal)

  const anfrage = alsJson(roh, 'Auftrag absenden') as FalAnfrage
  if (!anfrage.status_url || !anfrage.response_url) {
    throw new Error('fal.ai hat keine Adressen zum Nachfragen geliefert.')
  }
  if (!hostErlaubt(anfrage.status_url) || !hostErlaubt(anfrage.response_url)) {
    throw new Error('fal.ai hat auf eine fremde Adresse verwiesen — abgebrochen.')
  }
  return anfrage
}

export async function bildVergroessernKi(
  quelle: ArrayBuffer, faktor: number, verfahren: KiVerfahren, optionen: KiOptionen = {},
): Promise<KiErgebnis> {
  if (!Number.isInteger(faktor) || faktor < 2 || faktor > 4) {
    throw new Error(`Vergrößerungsfaktor ${faktor} ist nicht vorgesehen (erlaubt: 2 bis 4).`)
  }
  const modell = MODELLE[verfahren]
  if (!modell) throw new Error(`Unbekanntes KI-Verfahren: ${verfahren}`)
  const { signal, vorhandeneAnfrage, merken } = optionen

  // Zuerst nachsehen, ob ein früherer Versuch schon bezahlt hat.
  let anfrage: FalAnfrage | null = null
  let wiederaufgenommen = false

  if (vorhandeneAnfrage?.status_url && vorhandeneAnfrage.response_url
      && hostErlaubt(vorhandeneAnfrage.status_url)
      && hostErlaubt(vorhandeneAnfrage.response_url)) {
    const stand = await falRuf(vorhandeneAnfrage.status_url, { method: 'GET' }, signal)
    // 404 heißt: bei fal ist nichts mehr da (Ergebnisse werden nicht ewig
    // aufgehoben). Dann bleibt nur ein neuer Lauf — aber das ist eine
    // Feststellung, keine Annahme.
    if (stand.status !== 404) {
      anfrage = vorhandeneAnfrage
      wiederaufgenommen = true
    }
  }

  if (!anfrage) {
    anfrage = await absenden(quelle, faktor, modell, signal)
    // VOR dem ersten Warten festhalten. Zwischen Absenden und Merken darf
    // nichts liegen, was scheitern kann.
    await merken?.(anfrage)
  }

  const frist = Date.now() + config.falTimeoutMs
  let zustand = ''

  while (Date.now() < frist) {
    if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError')

    const roh = await falRuf(anfrage.status_url!, { method: 'GET' }, signal)
    zustand = String(alsJson(roh, 'Status abfragen').status ?? '')
    if (zustand === 'COMPLETED') break
    // IN_QUEUE und IN_PROGRESS sind die beiden Wartezustände. Alles andere ist
    // ein Abbruch bei fal, und weiterzufragen hieße, auf etwas zu warten, das
    // nie kommt.
    if (zustand !== 'IN_QUEUE' && zustand !== 'IN_PROGRESS') {
      throw new Error(`fal.ai meldet Zustand "${zustand}" — Vergrößerung abgebrochen.`)
    }
    await warten(NACHFRAGE_MS, signal)
  }

  if (zustand !== 'COMPLETED') {
    throw new Error(
      `fal.ai war nach ${Math.round(config.falTimeoutMs / 1000)}s noch nicht fertig. ` +
      'Der Auftrag läuft dort weiter und wird beim nächsten Versuch abgeholt.',
    )
  }

  const fertig = alsJson(
    await falRuf(anfrage.response_url!, { method: 'GET' }, signal), 'Ergebnis abholen',
  )
  // Wo das Bild in der Antwort steht, weiss die Modelltabelle — SeedVR2 legt es
  // unter `image` ab, Crystal als erstes Element von `images`.
  const bild = modell.bildAus(fertig)
  if (!bild.url) throw new Error('fal.ai hat kein Bild zurückgegeben.')

  const daten = await bildHolen(bild.url, signal)

  return {
    daten,
    nachher: { breite: bild.width ?? 0, hoehe: bild.height ?? 0 },
    wiederaufgenommen,
  }
}

/**
 * Erkennungszeichen am Dateianfang.
 *
 * Auch JPEG, obwohl bei beiden Modellen `output_format: 'png'` angefordert
 * wird: Google hat heute auf eine Anfrage, die PNG erwarten liess, ein JPEG
 * geliefert. Ein Anbieter, der das Format wechselt, soll hier keinen Auftrag
 * zum Scheitern bringen — geprueft wird, dass es ein BILD ist, nicht welches.
 */
const KENNUNGEN: Record<string, number[]> = {
  PNG:  [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  JPEG: [0xff, 0xd8, 0xff],
  WEBP: [0x52, 0x49, 0x46, 0x46],
}

/**
 * Das fertige Bild holen — und nachsehen, ob es wirklich eins ist.
 *
 * Ohne diese Prüfung landet eine HTML-Fehlerseite des CDN, mit HTTP 200
 * ausgeliefert, als `0.png` in der Ablage. Der Auftrag stünde auf „fertig", die
 * Kachel wäre kaputt und es gäbe keinen Fehlertext — bezahlt wäre es trotzdem.
 * Genau der Fall, in dem Stille wie Erfolg aussieht.
 *
 * Umleitungen werden von Hand verfolgt: `fetch` folgt ihnen sonst selbst, und
 * dann wäre nur die erste Adresse geprüft. Ein 302 von einem erlaubten
 * fal-Host auf `http://127.0.0.1:8317` würde befolgt.
 */
async function bildHolen(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  let ziel = url
  for (let sprung = 0; sprung < 5; sprung++) {
    if (!hostErlaubt(ziel)) {
      throw new Error('Das Ergebnisbild lag auf einer fremden Adresse — nicht geholt.')
    }
    let antwort: Response
    try {
      antwort = await fetch(ziel, {
        redirect: 'manual',
        signal: mitFrist(signal, 120_000),
      })
    } catch (e) {
      throw uebersetzeFehler(e as Error, signal, 120_000)
    }

    if (antwort.status >= 300 && antwort.status < 400) {
      const weiter = antwort.headers.get('location')
      if (!weiter) throw new Error('Umleitung ohne Ziel beim Holen des Ergebnisbildes.')
      ziel = new URL(weiter, ziel).toString()
      continue
    }
    if (!antwort.ok) {
      throw new Error(`Ergebnisbild ließ sich nicht laden: HTTP ${antwort.status}`)
    }

    const typ = antwort.headers.get('content-type') ?? ''
    if (!typ.startsWith('image/')) {
      throw new Error(`fal.ai lieferte "${typ.slice(0, 60)}" statt eines Bildes.`)
    }
    const daten = await antwort.arrayBuffer()
    if (daten.byteLength < 100) {
      throw new Error(`Das Ergebnisbild war nur ${daten.byteLength} Bytes groß.`)
    }
    const kopf = new Uint8Array(daten, 0, 8)
    const erkannt = Object.entries(KENNUNGEN)
      .some(([, muster]) => muster.every((b, i) => kopf[i] === b))
    if (!erkannt) {
      throw new Error('Das Ergebnis trug keine Bild-Kennung — nicht abgelegt.')
    }
    return daten
  }
  throw new Error('Zu viele Umleitungen beim Holen des Ergebnisbildes.')
}

/**
 * Warten, aber abbrechbar — sonst hinge Strg+C bis zur nächsten Nachfrage.
 *
 * Der Zuhörer wird wieder abgemeldet. Ohne das hingen bei 2-Sekunden-Takt und
 * langem Budget bis zu 150 Zuhörer an demselben Signal, und Node meldet ab 10
 * eine MaxListenersExceededWarning — harmlos in der Sache, aber sie sieht auf
 * der Konsole wie ein Defekt aus.
 */
function warten(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((fertig, fehler) => {
    const abbrechen = () => {
      clearTimeout(timer)
      fehler(new DOMException('Abgebrochen', 'AbortError'))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abbrechen)
      fertig()
    }, ms)
    signal?.addEventListener('abort', abbrechen, { once: true })
  })
}
