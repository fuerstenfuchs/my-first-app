import { supabase } from './supabase'
// Die Erkennung steht seit dem 04.09.2026 in `bildart.ts` — die Analyse
// braucht sie auch, und zwei Kopien liefen irgendwann auseinander.
import { typAusBytes } from './bildart'

/**
 * Erfasste Bilder in den eigenen Speicher holen.
 *
 * WARUM ES DIESE DATEI GIBT: Die Erweiterung hat beim Erfassen bisher die
 * ADRESSE des gefundenen Bildes in die Datenbank geschrieben, statt das Bild zu
 * kopieren. Am 03.09.2026 nachgezaehlt: 431 Eintraege zeigten auf fremde
 * Server, 28 davon waren zu dem Zeitpunkt schon tot — die Bilder sind
 * unwiederbringlich weg, ohne dass je etwas gemeldet haette, dass sie gehen.
 *
 * Zweite Folge: Ein geliehener Verweis taugt nicht als Referenzbild fuer die
 * Bilderzeugung. Der Arbeiter (`bildHolen` in `worker/src/supabase.ts`) lehnt
 * fremde Adressen ab, und zwar zu Recht — er laeuft auf Marks PC und erreicht
 * damit das ganze Heimnetz. Genau daran ist Marks Charakter-Sheet gescheitert.
 *
 * Die Erweiterung DARF fremde Adressen abrufen: Sie hat `<all_urls>` in den
 * `host_permissions`. Das ist der Unterschied zur Web-App, wo dafuer eigens
 * eine Server-Route (`/api/referenz-holen`, PROJ-43) gebaut werden musste.
 */

/** Welche Art Baustein in welchen Eimer gehoert. */
export type BausteinArt = 'character' | 'location' | 'outfit' | 'fashion' | 'pose'

/**
 * Die Zuordnung steht EINMAL hier, nicht als if-Kette ueber sieben Bildschirme
 * verteilt. Ein falscher Eimer schlaegt beim Hochladen stumm fehl — dann muss
 * man genau eine Tabelle pruefen, nicht sieben Dateien lesen.
 *
 * Nachgemessen an zwei unabhaengigen Quellen: der Zuordnung im Reparaturlauf
 * (`worker/src/bilder-nachholen.mts`, mit der 401 Bilder tatsaechlich abgelegt
 * wurden) und den `BUCKET`-Konstanten der Hauptanwendung (`src/hooks/use-*.ts`).
 * Beide stimmen ueberein. `fashion-assets` heisst als einziger nicht auf
 * `-images` — das ist kein Tippfehler, sondern der echte Name.
 */
const EIMER: Record<BausteinArt, string> = {
  character: 'character-images',
  location:  'location-images',
  outfit:    'outfit-images',
  fashion:   'fashion-assets',
  pose:      'pose-action-images',
}

/** Groesser als das laden wir nicht — 25 MB sind fuer ein Fundstueck reichlich. */
const HOECHSTGROESSE = 25 * 1024 * 1024

/** Nach dieser Zeit gilt ein fremder Server als nicht erreichbar. */
const GEDULD_MS = 30_000

export interface Sicherungsergebnis {
  /** Die Adresse, die in die Datenbank gehoert — eigene, wenn es geklappt hat. */
  url: string
  /** Liegt das Bild jetzt im eigenen Speicher? */
  gesichert: boolean
  /** Bei `gesichert === false`: warum nicht, in einem Satz fuer Mark. */
  fehler: string | null
}

/**
 * Die Adresse des eigenen Speichers.
 *
 * NICHT ueber `import.meta.env`: Die Erweiterung hat keine `vite-env.d.ts`,
 * jeder Zugriff darauf ist ein Typfehler mehr in einer Datei, die schon welche
 * hat. Der Klient kennt seine eigene Adresse ohnehin — wir fragen ihn danach,
 * indem wir uns eine oeffentliche Adresse fuer irgendeinen Pfad geben lassen
 * und nur die Herkunft davon behalten.
 */
function speicherHerkunft(): string | null {
  try {
    const { data } = supabase.storage.from(EIMER.character).getPublicUrl('probe')
    return new URL(data.publicUrl).origin
  } catch {
    return null
  }
}

/** Liegt die Adresse schon in Marks eigenem Speicher? */
export function liegtImEigenenSpeicher(url: string): boolean {
  const herkunft = speicherHerkunft()
  return !!herkunft && url.startsWith(herkunft)
}

/** Dateiendung zum Typ. Ohne Punkt. */
function endungZuTyp(typ: string): string {
  switch (typ) {
    case 'image/jpeg': return 'jpg'
    case 'image/png':  return 'png'
    case 'image/gif':  return 'gif'
    case 'image/webp': return 'webp'
    case 'image/avif': return 'avif'
    case 'image/heic': return 'heic'
    case 'image/bmp':  return 'bmp'
    default:           return 'bin'
  }
}

/** Eine Adresse so kuerzen, dass sie in eine Fehlermeldung passt. */
function kurz(url: string): string {
  if (url.startsWith('data:')) return 'Zuschnitt'
  try { return new URL(url).hostname.replace(/^www\./, '') }
  catch { return url.slice(0, 40) }
}

/**
 * Ein Bild in Marks eigenen Speicher holen.
 *
 * SCHEITERT DAS KOPIEREN, WIRD NICHT ABGEBROCHEN: Zurueck kommt dann die
 * urspruengliche Adresse, `gesichert: false` und ein Satz zum Warum. Der
 * Aufrufer legt den Baustein trotzdem an und zeigt den Hinweis. Ein verlorener
 * Fund waere schlimmer als ein geliehener Verweis — Mark steht sonst vor einer
 * Seite, die er vielleicht nie wiederfindet.
 */
export async function bildSichern(quelle: string, art: BausteinArt): Promise<Sicherungsergebnis> {
  const behalten = (fehler: string): Sicherungsergebnis => ({ url: quelle, gesichert: false, fehler })

  if (!quelle) return { url: quelle, gesichert: false, fehler: null }

  // Schon zuhause — nichts zu tun. Ein zweites Mal kopieren wuerde bei jedem
  // Speichern eine weitere Kopie im Eimer anlegen.
  if (liegtImEigenenSpeicher(quelle)) {
    return { url: quelle, gesichert: true, fehler: null }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return behalten('Nicht eingeloggt — Bild bleibt auf dem fremden Server.')

  // ── Holen ────────────────────────────────────────────────────────────────
  // Ein Zuschnitt kommt als `data:`-Adresse herein. Die wird HIER aufgeloest
  // und nicht ueber `fetch` — auf einer Erweiterungsseite gilt eine eigene
  // Inhaltsrichtlinie, und ein selbst gebauter Umweg ueber das Netz ist bei
  // Daten, die ohnehin schon im Speicher liegen, nur eine Fehlerquelle mehr.
  // Ohne diesen Zweig landete der ganze Zuschnitt als Text in der
  // Datenbankspalte und blaehte die Zeile um die gesamte Bilddatei auf.
  if (quelle.startsWith('data:')) {
    const komma = quelle.indexOf(',')
    if (komma < 0 || !quelle.slice(0, komma).includes('base64')) {
      return behalten('Zuschnitt liegt in einer Form vor, die sich nicht sichern laesst.')
    }
    try {
      const roh = atob(quelle.slice(komma + 1))
      const zugeschnitten = new Uint8Array(roh.length)
      for (let i = 0; i < roh.length; i++) zugeschnitten[i] = roh.charCodeAt(i)
      return ablegen(zugeschnitten, user.id, art, behalten, 'dem Zuschnitt')
    } catch {
      return behalten('Zuschnitt konnte nicht gelesen werden.')
    }
  }

  // Ohne `credentials`: Der Standard schickt bei fremder Herkunft keine Kekse
  // mit. Das ist gewollt — die Erweiterung soll nicht Marks Anmeldung bei
  // irgendeinem Portal an dessen Bildserver weiterreichen.
  let bytes: Uint8Array
  const abbruch = new AbortController()
  const wecker = setTimeout(() => abbruch.abort(), GEDULD_MS)
  try {
    const antwort = await fetch(quelle, { signal: abbruch.signal })
    if (!antwort.ok) return behalten(`${kurz(quelle)} antwortete mit ${antwort.status}.`)
    const puffer = await antwort.arrayBuffer()
    if (puffer.byteLength === 0) return behalten(`${kurz(quelle)} lieferte eine leere Datei.`)
    if (puffer.byteLength > HOECHSTGROESSE) {
      return behalten(`Bild ist ${Math.round(puffer.byteLength / 1024 / 1024)} MB gross — zu gross zum Sichern.`)
    }
    bytes = new Uint8Array(puffer)
  } catch (err) {
    const grund = abbruch.signal.aborted
      ? `${kurz(quelle)} hat nicht innerhalb von ${GEDULD_MS / 1000} Sekunden geantwortet.`
      : `${kurz(quelle)} war nicht erreichbar (${err instanceof Error ? err.message : 'unbekannt'}).`
    return behalten(grund)
  } finally {
    clearTimeout(wecker)
  }

  return ablegen(bytes, user.id, art, behalten, kurz(quelle))
}

/**
 * Die geholten Bytes im eigenen Eimer ablegen.
 *
 * DER PFAD MUSS MIT DER NUTZERKENNUNG BEGINNEN. Alle Eimer haben dieselbe
 * Schreibregel: `(storage.foldername(name))[1] = auth.uid()::text`. Ein anderer
 * erster Ordner wird abgelehnt — und die Meldung dazu sagt einem Menschen
 * nicht, woran es lag. Deshalb wird der Pfad hier an genau einer Stelle gebaut
 * und nirgends von aussen hereingereicht.
 */
async function ablegen(
  bytes: Uint8Array,
  nutzerId: string,
  art: BausteinArt,
  behalten: (fehler: string) => Sicherungsergebnis,
  herkunft = 'der Quelle',
): Promise<Sicherungsergebnis> {
  const typ = typAusBytes(bytes)
  if (!typ) return behalten(`Von ${herkunft} kam kein erkennbares Bild zurueck.`)

  const pfad = `${nutzerId}/erfasst/${crypto.randomUUID()}.${endungZuTyp(typ)}`

  const { error: hochError } = await supabase.storage
    .from(EIMER[art])
    .upload(pfad, new Blob([bytes as BlobPart], { type: typ }), { contentType: typ, upsert: false })

  if (hochError) return behalten(`Ablegen im eigenen Speicher fehlgeschlagen: ${hochError.message}`)

  const { data: { publicUrl } } = supabase.storage.from(EIMER[art]).getPublicUrl(pfad)
  return { url: publicUrl, gesichert: true, fehler: null }
}

/**
 * Mehrere Bilder nacheinander sichern — fuer Outfits, die aus mehreren
 * Ansichten bestehen.
 *
 * NACHEINANDER, nicht alle auf einmal: Bei einem Outfit mit acht Ansichten von
 * derselben Seite sieht ein Schwall gleichzeitiger Anfragen fuer den fremden
 * Server aus wie ein Angriff, und manche sperren daraufhin alle. Der Fortschritt
 * wird nach jedem Bild gemeldet, damit das Speichern nicht wie ein Haenger
 * aussieht.
 */
export async function bilderSichern(
  quellen: string[],
  art: BausteinArt,
  fortschritt?: (fertig: number, gesamt: number) => void,
): Promise<Sicherungsergebnis[]> {
  const ergebnisse: Sicherungsergebnis[] = []
  for (let i = 0; i < quellen.length; i++) {
    fortschritt?.(i, quellen.length)
    ergebnisse.push(await bildSichern(quellen[i]!, art))
  }
  fortschritt?.(quellen.length, quellen.length)
  return ergebnisse
}

/**
 * Aus mehreren Ergebnissen einen Satz machen, den Mark lesen kann.
 * `null`, wenn alles geklappt hat.
 */
export function sicherungsHinweis(ergebnisse: Sicherungsergebnis[]): string | null {
  const misslungen = ergebnisse.filter(e => !e.gesichert && e.fehler)
  if (misslungen.length === 0) return null
  if (misslungen.length === 1) {
    return `Hinweis: Das Bild konnte nicht in deinen Speicher kopiert werden — es bleibt als Verweis auf den fremden Server gespeichert und kann dort verschwinden. Grund: ${misslungen[0]!.fehler}`
  }
  return `Hinweis: ${misslungen.length} von ${ergebnisse.length} Bildern konnten nicht in deinen Speicher kopiert werden — sie bleiben als Verweis auf fremde Server gespeichert und koennen dort verschwinden. Erster Grund: ${misslungen[0]!.fehler}`
}
