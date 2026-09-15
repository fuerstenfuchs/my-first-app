import { toast } from 'sonner'

/**
 * Eine Speicherdatei freigeben — aber nur, wenn niemand mehr auf sie zeigt.
 *
 * WARUM ES DAS GIBT: Byte-gleiche Bilder sollen später zu EINER Datei
 * zusammengelegt werden. Dann zeigen mehrere Zeilen auf dieselbe Datei, auch
 * aus verschiedenen Bausteinen und Eimern. Bis zum 15.09.2026 löschte jede
 * Löschstelle ihre Datei ohne Nachfrage, jede mit ihrem eigenen fest
 * verdrahteten Eimer. Nach dem Zusammenlegen wäre ein Bild damit still für
 * alle ANDEREN Zeilen verschwunden.
 *
 * DIE REIHENFOLGE KEHRT SICH UM — und das ist eine bewusste Abwägung:
 *
 *   Früher: erst die Datei, dann die Zeile (Begründung stand in
 *   `use-bild-loeschen.ts`: sonst bliebe eine verwaiste Datei zurück).
 *
 *   Jetzt: erst die Zeile löschen bzw. das Titelbild umhängen, DANN zählen,
 *   dann freigeben. Andersherum zählte die eigene, gerade zu löschende Zeile
 *   noch mit — die Datei käme nie weg. Scheitert nach dem Löschen der Zeile das
 *   Zählen oder das Löschen der Datei, bleibt eine verwaiste Datei liegen.
 *
 *   Das ist der billigere Fehler. Eine verwaiste Datei kostet ein paar MB
 *   Speicher und lässt sich später einsammeln. Eine zu früh gelöschte Datei ist
 *   ein kaputtes Bild in einer Zeile, von der niemand weiß, dass sie betroffen
 *   ist — und es gibt kein Zurück.
 *
 * SCHLÄGT DIE ZÄHLUNG FEHL, WIRD NICHT GELÖSCHT. Keine Antwort ist nicht
 * „null Verweise". Das gilt auch, wenn die Datenbankfunktion noch gar nicht
 * angelegt ist (`supabase/migrations/20260915_datei_verweise.sql`).
 *
 * WER SONST NOCH LÖSCHEN DARF: nur die zwei Rückbau-Stellen, die ihre eigene,
 * gerade hochgeladene Datei wieder wegräumen. `speicher-loeschstellen.test.ts`
 * wird rot, sobald irgendwo sonst ein Löschaufruf auf dem Speicher auftaucht.
 * (Das Wort wird hier bewusst nicht ausgeschrieben — der Wächter zählt Text.)
 */

export type DateiOrt = { bucket: string; pfad: string }

/** Wo die kleine Vorschau liegt — siehe `worker/src/vorschaubilder.mts`. */
export const VORSCHAU_PRAEFIX = 'vorschau/'

/** `code` trägt PostgREST etwa `PGRST202` — er steht NICHT im Text. */
type Fehler = { message: string; code?: string } | null

/**
 * Nur das, was diese Hilfe vom Supabase-Client braucht.
 *
 * WARUM NICHT DER VOLLE CLIENT-TYP: So lässt sich die Entscheidung „löschen
 * oder nicht" mit einem kleinen Doppel prüfen, ohne Netz und ohne Attrappe
 * für den halben Client.
 */
export type SpeicherZugang = {
  rpc: (
    fn: 'datei_verweise',
    args: { p_bucket: string; p_pfad: string },
  ) => PromiseLike<{ data: unknown; error: Fehler }>
  storage: {
    from: (bucket: string) => {
      remove: (pfade: string[]) => PromiseLike<{ data?: { name?: string }[] | null; error: Fehler }>
      /** Nur zum Nachsehen, ob eine Datei nach dem Löschen noch da ist. */
      list: (
        ordner: string, optionen: { search: string; limit: number },
      ) => PromiseLike<{ data: { name?: string }[] | null; error: Fehler }>
    }
  }
}

/**
 * Was mit `vorschau/<pfad>.jpg` geschieht: Der Browser fasst sie nicht an —
 * siehe „VORSCHAUDATEIEN" weiter unten.
 */
export type VorschauStatus = 'bleibt-fuer-arbeiter'

export type FreigabeErgebnis =
  /** Die Datei ist weg. Ihre Vorschau bleibt liegen, bis ein Lauf mit Dienstschlüssel aufräumt. */
  | { status: 'geloescht'; ort: DateiOrt; vorschau: VorschauStatus }
  /** Die Eingabe WAR eine Vorschaudatei — die löscht der Browser nie. */
  | { status: 'bleibt-fuer-arbeiter'; ort: DateiOrt }
  /** Andere Zeilen zeigen noch darauf — die Datei bleibt. Der Normalfall nach dem Zusammenlegen. */
  | { status: 'noch-verwendet'; ort: DateiOrt; verweise: number }
  /** Zählen ging nicht — die Datei bleibt, lieber verwaist als kaputt. */
  | { status: 'zaehlfehler'; ort: DateiOrt; fehler: string }
  /** Gezählt, niemand zeigt darauf, aber das Löschen schlug fehl. */
  | { status: 'loeschfehler'; ort: DateiOrt; fehler: string }
  /** Keine Datei in unserem Speicher (fremde Adresse, leer) — nichts zu tun. */
  | { status: 'kein-speicherort' }

// ─── Zerlegen ────────────────────────────────────────────────────────────────

/*
  DIESELBE REGEL WIE `public.datei_schluessel` IN DER MIGRATION.

  Laufen beide auseinander, findet die Datenbank einen Verweis nicht, zählt
  zu wenig — und die Datei wird gelöscht, obwohl sie gebraucht wird. Die
  Beispiele in `datei-schluessel-beispiele.json` stehen deshalb wörtlich auch
  in der Migration, und ein Test prüft beides gegeneinander.
*/
const SPEICHER_ADRESSE =
  /\/storage\/v1\/(?:object|render\/image)\/(?:public|sign|authenticated)\/([^/]+\/.+)$/

/** Der Teil vor `#`, dann vor `?` — der Zwischenspeicher-Brecher `?v=` gehört nicht zur Datei. */
function ohneAnhang(s: string): string {
  return s.split('#')[0].split('?')[0]
}

/** Wie `btrim(p, E' \t\r\n')` in SQL — bewusst NICHT `trim()`, das mehr Zeichen kennt. */
function ohneRandLeerraum(s: string): string {
  return s.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '')
}

/**
 * Prozent-Kodierung auflösen — Zeichen für Zeichen wie `public.datei_dekodiert`.
 *
 * WARUM NICHT `decodeURIComponent`: Das wirft bei einem einzigen kaputten
 * `%zz` und ließe dann die ganze Adresse roh — SQL dekodiert die gültigen
 * Stellen trotzdem. Zwei verschiedene Schlüssel für dieselbe Adresse wären
 * genau das Auseinanderlaufen, das zu wenig zählt.
 *
 * Regel: `%` + zwei Hex-Ziffern (groß oder klein) → ein Byte; alles andere
 * bleibt. Ist das Ergebnis kein gültiges UTF-8, bleibt die GANZE Eingabe roh.
 */
export function prozentDekodiert(s: string): string {
  if (!s.includes('%')) return s
  const zeichen = Array.from(s)
  const bytes: number[] = []
  const kodierer = new TextEncoder()
  for (let i = 0; i < zeichen.length;) {
    const c = zeichen[i]
    const hex = (zeichen[i + 1] ?? '') + (zeichen[i + 2] ?? '')
    if (c === '%' && i + 2 < zeichen.length && /^[0-9A-Fa-f]{2}$/.test(hex)) {
      bytes.push(parseInt(hex, 16))
      i += 3
    } else {
      bytes.push(...kodierer.encode(c))
      i += 1
    }
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(new Uint8Array(bytes))
  } catch {
    return s
  }
}

/**
 * Nur der Schlüssel `<eimer>/<pfad>` — genau das, was SQL daraus macht.
 * Ohne Projektprüfung und ohne `..`-Prüfung; die kommen in {@link dateiOrtAus}.
 */
export function dateiSchluessel(url: string | null | undefined): string | null {
  if (url == null) return null
  const m = SPEICHER_ADRESSE.exec(ohneAnhang(ohneRandLeerraum(url)))
  return m ? prozentDekodiert(m[1]) : null
}

/**
 * Bucket und Pfad aus einer Adresse oder einem (Bucket, Pfad)-Paar.
 *
 * `null` heißt „nicht unsere Datei" — dann wird nichts gelöscht. Das gilt für
 * leere Werte, fremde Adressen (`https://example.com/x.jpg`) und Pfade mit
 * `..`, die aus dem Ordner herausführen könnten.
 *
 * `basis` ist die Supabase-Adresse des Projekts. Eine Adresse eines ANDEREN
 * Supabase-Projekts hat dieselbe Form; ohne diese Prüfung würde deren Pfad im
 * eigenen Speicher gelöscht. Fehlt `basis`, wird eine Adresse nie als eigene
 * erkannt — der sichere Ausgang.
 */
export function dateiOrtAus(
  eingabe: string | DateiOrt | null | undefined,
  basis: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): DateiOrt | null {
  if (!eingabe) return null

  let bucket: string
  let pfad: string

  if (typeof eingabe === 'string') {
    const adresse = ohneRandLeerraum(eingabe)
    if (!basis || !adresse.startsWith(`${basis.replace(/\/+$/, '')}/storage/v1/`)) return null
    const schluessel = dateiSchluessel(adresse)
    if (!schluessel) return null
    const schnitt = schluessel.indexOf('/')
    if (schnitt < 0) return null
    bucket = schluessel.slice(0, schnitt)
    pfad = schluessel.slice(schnitt + 1)
  } else {
    bucket = ohneRandLeerraum(eingabe.bucket ?? '')
    pfad = prozentDekodiert(ohneAnhang(ohneRandLeerraum(eingabe.pfad ?? ''))).replace(/^\/+/, '')
  }

  if (!bucket || !pfad) return null
  if (pfad.split('/').some(teil => teil === '..' || teil === '.')) return null
  return { bucket, pfad }
}

/** Zeigen zwei Adressen auf dieselbe Datei? `?v=` und Kodierung spielen keine Rolle. */
export function gleicheDatei(
  a: string | null | undefined,
  b: string | null | undefined,
  basis: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): boolean {
  if (!a || !b) return false
  if (ohneAnhang(ohneRandLeerraum(a)) === ohneAnhang(ohneRandLeerraum(b))) return true
  const oa = dateiOrtAus(a, basis)
  const ob = dateiOrtAus(b, basis)
  return !!oa && !!ob && oa.bucket === ob.bucket && oa.pfad === ob.pfad
}

export function vorschauPfad(pfad: string): string {
  return `${VORSCHAU_PRAEFIX}${pfad}.jpg`
}

// ─── Titelbild ───────────────────────────────────────────────────────────────

export type TitelbildBaustein = 'charaktere' | 'outfits' | 'locations' | 'posen'

/**
 * SCHALTER: Wird das Titelbild beim Löschen seines Bildes durch das nächste
 * ersetzt? `false` heißt „Titelbild nicht anfassen".
 *
 * ENTSCHIEDEN AM 15.09.2026 VON MARK: „B, das Titelbild bleibt" — für alle
 * vier Bausteine, ausdrücklich auch für Charaktere, die bis dahin automatisch
 * das nächste Bild bekamen. WARUM: Mark baut seine Titelbilder mühsam von Hand,
 * damit sie einheitlich aussehen (siehe `use-bild-uebernehmen.ts`, 02.09.2026).
 * Ein beliebiges nächstes Bild aus der Variante wäre eine stille Änderung genau
 * dieser Arbeit, ausgelöst von einem Klick, der etwas ganz anderes wollte.
 *
 * WARUM DADURCH NIE EIN TITELBILD OHNE DATEI ENTSTEHT: `cover_image_url` und
 * `crop_image_url` sind Kernstellen in `public.datei_verweise`. Solange das
 * Titelbild auf die Datei zeigt, zählt es als Verweis — die Datei bleibt
 * liegen, auch wenn ihr Bild aus der Variante gelöscht ist. Scheitert die
 * Zählung, wird ohnehin nicht gelöscht. Der Preis ist Speicher, nicht ein
 * kaputtes Titelbild.
 *
 * Bei Outfits hängt das Leeren des Zuschnitts am selben Schalter.
 * Ein Test (`datei-freigeben.test.ts`) hält diese Entscheidung fest: Wer hier
 * einen Schalter umlegt, muss den Test mit ändern und damit bewusst
 * entscheiden.
 */
export const TITELBILD_BEIM_LOESCHEN_NACHZIEHEN: Record<TitelbildBaustein, boolean> = {
  charaktere: false,
  outfits:    false,
  locations:  false,
  posen:      false,
}

/**
 * Muss das Titelbild nachgezogen werden, weil sein Bild gerade gelöscht wurde?
 *
 * WARUM DAS VOR DEM FREIGEBEN STEHEN MUSS: Das Titelbild ist selbst ein
 * Verweis. Zeigt es noch auf die Datei, zählt die Datenbank es mit, und die
 * Datei bleibt liegen.
 *
 * Das nächste Bild wird genommen, wie es `use-characters.ts` seit jeher tut.
 * Eines, das auf DIESELBE Datei zeigt (Doppel nach dem Zusammenlegen), taugt
 * nicht als Ersatz — es wäre dasselbe Bild unter anderem Namen.
 */
export function titelbildNachLoeschen(
  baustein: TitelbildBaustein,
  titelbild: string | null | undefined,
  geloeschteUrl: string | null | undefined,
  verbleibende: (string | null | undefined)[],
  optionen: { nachziehen?: boolean; basis?: string } = {},
): { aendern: false } | { aendern: true; neu: string | null } {
  const nachziehen = optionen.nachziehen ?? TITELBILD_BEIM_LOESCHEN_NACHZIEHEN[baustein]
  const basis = 'basis' in optionen ? optionen.basis : process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!nachziehen) return { aendern: false }
  if (!titelbild || !geloeschteUrl || !gleicheDatei(titelbild, geloeschteUrl, basis)) {
    return { aendern: false }
  }
  const neu = verbleibende.find((u): u is string => !!u && !gleicheDatei(u, geloeschteUrl, basis)) ?? null
  return { aendern: true, neu }
}

// ─── Entscheiden und freigeben ───────────────────────────────────────────────

/**
 * Die eine Entscheidung, als reine Funktion: Darf die Datei weg?
 *
 * Nur bei einer sauberen Antwort „genau null". Ein Fehler, eine fehlende Zahl,
 * eine Zeichenkette, eine negative Zahl — alles heißt: behalten.
 */
export function darfLoeschen(anzahl: unknown, fehler: Fehler | undefined): boolean {
  if (fehler) return false
  return typeof anzahl === 'number' && Number.isInteger(anzahl) && anzahl === 0
}

type MeldungsArt = 'zaehlfehler' | 'loeschfehler'
const gemeldet: Record<MeldungsArt, boolean> = { zaehlfehler: false, loeschfehler: false }
const meldungSchluessel = (art: MeldungsArt) => `datei-freigeben:${art}-gemeldet`

/** Einmal je Sitzung UND je Art: `true` heißt „jetzt melden". */
function einmalJeSitzung(art: MeldungsArt): boolean {
  if (gemeldet[art]) return false
  gemeldet[art] = true
  try {
    if (sessionStorage.getItem(meldungSchluessel(art))) return false
    sessionStorage.setItem(meldungSchluessel(art), '1')
  } catch { /* ohne Sitzungsspeicher genügt die Modulmarke */ }
  return true
}

/** Leerraum zusammenziehen, auf 160 Zeichen kürzen — eine Einblendung ist kein Protokoll. */
function kuerzen(fehler: string): string {
  const grund = fehler.replace(/\s+/g, ' ').trim() || 'unbekannt'
  return grund.length > 160 ? `${grund.slice(0, 159)}…` : grund
}

/**
 * EINMAL JE SITZUNG SICHTBAR MACHEN, DASS NICHT AUFGERÄUMT WIRD.
 *
 * WARUM: Fehlt die Datenbankfunktion, bleibt jede gelöschte Datei liegen —
 * nichts geht kaputt, also fällt es auch niemandem auf. Nur `console.warn`
 * hieße, dass sich monatelang Speicher füllt, ohne dass Mark es erfährt.
 *
 * WARUM NUR EINMAL: Bei jedem Löschen dieselbe Meldung wäre ein Dauerbanner,
 * und das wird nach zwei Tagen weggeklickt, ohne gelesen zu werden.
 */
function zaehlfehlerMelden(fehler: string): void {
  if (!einmalJeSitzung('zaehlfehler')) return
  const { titel, beschreibung } = zaehlfehlerText(fehler)
  toast.warning(titel, { description: beschreibung, duration: 12_000 })
}

/**
 * LÖSCHFEHLER EBENSO EINMAL JE SITZUNG (15.09.2026, Critic K3).
 *
 * Gezählt, niemand verweist, aber der Speicher verweigert das Löschen — etwa
 * weil ein Eimer keine Löschregel für den eigenen Ordner hat. Dann bleibt
 * JEDE Datei dieses Eimers liegen, und wie beim Zählfehler merkt es niemand.
 * Eigene Marke, damit ein früher Zählfehler diese Meldung nicht verschluckt.
 */
function loeschfehlerMelden(fehler: string): void {
  if (!einmalJeSitzung('loeschfehler')) return
  toast.warning('Speicher wird nicht aufgeräumt', {
    description: `Eine Datei ließ sich nicht löschen. Grund: ${kuerzen(fehler)} — sie bleibt liegen, kaputt geht nichts.`,
    duration: 12_000,
  })
}

/**
 * Was Mark bei einem Zählfehler zu lesen bekommt.
 *
 * „FUNKTION FEHLT" NUR, WENN SIE ES WIRKLICH IST: `PGRST202`, oder der Name
 * `datei_verweise` UND „does not exist" bzw. „could not find the function".
 *
 * Zweimal nachgeschärft am 15.09.2026:
 *  · Zuerst genügte das Wort `datei_verweise`. Damit beginnen aber auch die
 *    eigenen Abbrüche der Funktion („Kernstelle … nicht sichtbar", „RLS, aber
 *    keine Regel"). Mark hätte die Funktion gesucht, obwohl sie da ist.
 *  · Dann genügte „function … does not exist". So heißt aber auch ein
 *    Typfehler INNERHALB der Funktion, etwa `function strpos(jsonb, text)
 *    does not exist` — die Funktion ist da, eine Zeile darin ist falsch.
 *
 * In allen anderen Fällen steht der Grund selbst da, gekürzt: Er ist die
 * einzige Spur.
 */
export function zaehlfehlerText(fehler: string): { titel: string; beschreibung: string } {
  const titel = 'Speicher wird nicht aufgeräumt'
  const nachsatz = 'Gelöschte Bilder bleiben als Datei liegen — kaputt geht nichts.'
  const funktionFehlt = /PGRST202/i.test(fehler) || (
    /\bdatei_verweise\b/i.test(fehler) && /could not find the function|does not exist/i.test(fehler)
  )
  if (funktionFehlt) {
    return { titel, beschreibung: `Die Datenbankfunktion zum Zählen fehlt. ${nachsatz}` }
  }
  return { titel, beschreibung: `Grund: ${kuerzen(fehler)} — ${nachsatz}` }
}

/** Nur für Tests: die Einmal-Meldung wieder scharf stellen. */
export function zaehlfehlerMeldungZuruecksetzen(): void {
  for (const art of ['zaehlfehler', 'loeschfehler'] as const) {
    gemeldet[art] = false
    try { sessionStorage.removeItem(meldungSchluessel(art)) } catch { /* egal */ }
  }
}

/** Zählt die Verweise. Wirft nicht — gibt den Fehler zurück. */
async function verweiseZaehlen(
  zugang: SpeicherZugang, ort: DateiOrt,
): Promise<{ anzahl: number; fehler: null } | { anzahl: null; fehler: string }> {
  try {
    // Ein Aufruf genügt: Die Datenbank dekodiert jede gespeicherte Adresse
    // selbst, bevor sie vergleicht — Groß- wie Kleinbuchstaben-Hex.
    const { data, error } = await zugang.rpc('datei_verweise', { p_bucket: ort.bucket, p_pfad: ort.pfad })
    // Den Code MIT weitergeben (15.09.2026, Critic K3): PostgREST meldet eine
    // fehlende Funktion als `code: 'PGRST202'`, der Text allein nennt ihn
    // nicht. Ohne ihn war die Erkennung in `zaehlfehlerText` ein toter Zweig.
    if (error) return { anzahl: null, fehler: error.code ? `${error.code}: ${error.message}` : error.message }
    if (typeof data !== 'number' || !Number.isInteger(data) || data < 0) {
      return { anzahl: null, fehler: `Unerwartete Antwort der Zählung: ${JSON.stringify(data)}` }
    }
    return { anzahl: data, fehler: null }
  } catch (e) {
    return { anzahl: null, fehler: (e as Error)?.message ?? String(e) }
  }
}

/**
 * Gibt EINE Datei frei. Aufrufen, NACHDEM die eigene Zeile gelöscht bzw. das
 * Titelbild umgehängt ist — siehe Kopfkommentar.
 *
 * Wirft nie. Die Zeile ist beim Aufruf schon weg; ein Wurf hier ließe den
 * Aufrufer glauben, das Löschen sei gescheitert, obwohl nur Speicher liegen
 * bleibt.
 */
export async function dateiFreigeben(
  zugang: SpeicherZugang,
  eingabe: string | DateiOrt | null | undefined,
  basis: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): Promise<FreigabeErgebnis> {
  const ort = dateiOrtAus(eingabe, basis)
  if (!ort) return { status: 'kein-speicherort' }
  // Eine Vorschaudatei selbst — etwa von Hand als Titelbild eingefügt — kann
  // der Browser nicht löschen (siehe „VORSCHAUDATEIEN"). Ein Versuch ergäbe
  // nur einen falschen Alarm; also gar nicht erst zählen und nicht löschen.
  if (ort.pfad.startsWith(VORSCHAU_PRAEFIX)) return { status: 'bleibt-fuer-arbeiter', ort }

  const zaehlung = await verweiseZaehlen(zugang, ort)
  if (zaehlung.fehler !== null) {
    console.warn(`Datei bleibt liegen, Zählung fehlgeschlagen (${ort.bucket}/${ort.pfad}):`, zaehlung.fehler)
    zaehlfehlerMelden(zaehlung.fehler)
    return { status: 'zaehlfehler', ort, fehler: zaehlung.fehler }
  }
  if (!darfLoeschen(zaehlung.anzahl, null)) {
    // Solange die Datei gebraucht wird, wird auch ihre Vorschau gebraucht —
    // sie wird deshalb gar nicht erst gezählt.
    return { status: 'noch-verwendet', ort, verweise: zaehlung.anzahl }
  }

  const hauptFehler = await entfernen(zugang, ort)
  if (hauptFehler) return { status: 'loeschfehler', ort, fehler: hauptFehler }

  return { status: 'geloescht', ort, vorschau: 'bleibt-fuer-arbeiter' }
}

/** Löscht genau einen Pfad. Liefert den Fehlertext oder `null`. Wirft nie. */
async function entfernen(zugang: SpeicherZugang, ort: DateiOrt): Promise<string | null> {
  try {
    const { data, error } = await zugang.storage.from(ort.bucket).remove([ort.pfad])
    if (error) {
      // Eine schon fehlende Datei ist erledigt, nicht gescheitert — sonst bliebe
      // jede Zeile mit fehlender Datei für immer „nicht freigebbar".
      if (/not.?found|does not exist|404/i.test(error.message)) return null
      return loeschfehlerMerken(ort, error.message)
    }

    /*
      KEIN FEHLER HEISST NICHT GELÖSCHT (15.09.2026, Critic S2).

      Fehlt dem Eimer eine Löschregel für den Ordner, antwortet der Speicher
      nach Critics Kenntnis nicht mit einem Fehler, sondern mit einer LEEREN
      Liste gelöschter Dateien — gemessen ist das nicht. Die Datei bliebe dann
      still liegen, und die Einmal-Meldung käme nie.

      Deshalb gilt nur als gelöscht, was in der Antwort steht. Fehlt es dort,
      wird nachgesehen: Ist die Datei noch da, war es ein Löschfehler; ist sie
      weg, war sie es schon vorher (eine fehlende Datei liefert dieselbe leere
      Liste) — erledigt. Ist das Nachsehen nicht möglich, lieber melden als
      schweigen.
    */
    if (Array.isArray(data) && data.some(o => o?.name === ort.pfad)) return null
    const nochDa = await nochVorhanden(zugang, ort)
    if (nochDa === false) return null
    return loeschfehlerMerken(ort, nochDa === true
      ? 'Der Speicher hat die Datei nicht gelöscht (fehlt dem Eimer eine Löschregel?)'
      : `Löschen nicht bestätigt: ${nochDa}`)
  } catch (e) {
    return loeschfehlerMerken(ort, (e as Error)?.message ?? String(e))
  }
}

/** Protokoll und Einmal-Meldung für einen Löschfehler. Liefert den Fehlertext. */
function loeschfehlerMerken(ort: DateiOrt, fehler: string): string {
  console.warn(`Datei ließ sich nicht löschen (${ort.bucket}/${ort.pfad}):`, fehler)
  loeschfehlerMelden(fehler)
  return fehler
}

/**
 * Liegt die Datei noch im Speicher? `true`/`false`, oder der Fehlertext, wenn
 * es sich nicht feststellen lässt.
 *
 * GRENZE: Das Nachsehen braucht Leserechte auf die Liste. Die öffentlichen
 * Eimer haben eine Leseregel (proj-37). Fehlte sie, käme auch hier eine leere
 * Liste zurück, und eine liegengebliebene Datei gälte als „schon weg".
 */
async function nochVorhanden(zugang: SpeicherZugang, ort: DateiOrt): Promise<boolean | string> {
  const schnitt = ort.pfad.lastIndexOf('/')
  const ordner = schnitt < 0 ? '' : ort.pfad.slice(0, schnitt)
  const name = ort.pfad.slice(schnitt + 1)
  try {
    const { data, error } = await zugang.storage.from(ort.bucket).list(ordner, { search: name, limit: 100 })
    if (error) return error.message
    return (data ?? []).some(o => o?.name === name)
  } catch (e) {
    return (e as Error)?.message ?? String(e)
  }
}

/*
  VORSCHAUDATEIEN FASST DER BROWSER NICHT AN (15.09.2026, Critic B1).

  Die Vorschau liegt unter `vorschau/<nutzer>/….jpg`
  (`worker/src/vorschaubilder.mts`). Der ERSTE Ordner ist also `vorschau`, und
  die Löschregeln der Eimer erlauben nur `foldername[1] = auth.uid()`. Der
  Browser kann eine Vorschau deshalb nie löschen — egal, was er versucht.

  Der Zwischenstand vom selben Tag hat es trotzdem versucht, mit zwei Folgen:
   · In öffentlich lesbaren Eimern fand das Nachsehen die Vorschau noch und
     meldete bei der ersten Bildlöschung jeder Sitzung „Speicher wird nicht
     aufgeräumt" — ein falscher Alarm, der obendrein die Einmal-Marke
     verbrauchte. Ein ECHTER Löschfehler an einer Hauptdatei blieb danach stumm.
   · In Eimern, die nur im eigenen Ordner lesbar sind (outfit-, pose-action-,
     location-images, fashion-assets), fand das Nachsehen nichts, und die
     Vorschau galt fälschlich als gelöscht.

  Deshalb: kein Löschaufruf, kein Nachsehen, KEINE ZÄHLUNG für `vorschau/`.
  Die Zählung entfällt bewusst mit — ihr einziger Zweck war die Entscheidung
  „löschen oder nicht", und die gibt es im Browser nicht mehr. Eine eigens von
  Hand als Titelbild eingefügte Vorschau-Adresse ist damit auch sicher: Es
  gibt schlicht nichts, das sie löschen könnte.

  AUFRÄUMEN SPÄTER, NICHT JETZT: Verwaiste Vorschaudateien (Vorschau da,
  Hauptdatei weg) räumt ein Lauf mit Dienstschlüssel im Arbeiter ab — der darf
  überall löschen. Er muss vorher über `datei_verweise` zählen, ob jemand die
  Vorschau-Adresse selbst verwendet.
*/

/**
 * Mehrere Dateien nacheinander freigeben, jede nur einmal.
 *
 * NACHEINANDER, NICHT PARALLEL: Zeigen zwei Eingaben auf dieselbe Datei
 * (einmal als Adresse, einmal als Pfad), würden zwei gleichzeitige Läufe beide
 * zählen und beide löschen wollen. Die Doppelten fallen deshalb vorher raus.
 */
export async function dateienFreigeben(
  zugang: SpeicherZugang,
  eingaben: (string | DateiOrt | null | undefined)[],
  basis: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): Promise<FreigabeErgebnis[]> {
  const gesehen = new Set<string>()
  const ergebnisse: FreigabeErgebnis[] = []
  for (const eingabe of eingaben) {
    const ort = dateiOrtAus(eingabe, basis)
    if (!ort) continue
    const schluessel = `${ort.bucket}/${ort.pfad}`
    if (gesehen.has(schluessel)) continue
    gesehen.add(schluessel)
    ergebnisse.push(await dateiFreigeben(zugang, ort))
  }
  return ergebnisse
}
