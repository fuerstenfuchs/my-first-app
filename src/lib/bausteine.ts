import {
  Users, Shirt, ShoppingBag, MapPin, Drama, FileText, type LucideIcon,
} from 'lucide-react'

/**
 * Die Bausteine als Daten — wohin ein fertiges Bild übernommen werden kann.
 *
 * WARUM ALS TABELLE UND NICHT ALS NEUN FUNKTIONEN: Die Bibliotheken sind bis
 * auf Namen fast gleich gebaut. Nachgemessen am 02.09.2026 haben alle
 * Bildtabellen dieselben Spalten — bis auf drei Unterschiede, die hier als
 * Felder stehen statt als `if` im Ablauf:
 *
 *  1. Die einen hängen an einer VARIANTE (`variant_id`), die Prompts direkt am
 *     Prompt (`prompt_id`).
 *  2. `prompt_media` hat KEINE Spalte `storage_path` — dort merkt sich die App
 *     den Speicherpfad nicht.
 *  3. `prompt_media` verlangt ein `type` ('image' oder 'video', per Schranke).
 *
 * Im Projekt steht der Ablauf „hochladen → öffentliche Adresse holen → Zeile
 * einfügen" acht- bis zehnmal da, jedes Mal leicht anders. Genau daraus
 * entstehen die Unterschiede, die später niemand mehr erklären kann. Ein
 * zehnter Baustein ist hier ein Eintrag, keine Kopie.
 */

export type BausteinSchluessel =
  | 'charaktere' | 'outfits' | 'fashion' | 'locations' | 'posen'
  | 'prompts'

/**
 * Welche Zusatzspalten ein Baustein hat — und wie sie dort HEISSEN.
 *
 * WARUM ALS DATUM UND NICHT ALS `if` IM HOOK: Die Spalten sind nicht überall
 * gleich, und eine fehlende Spalte lässt die GANZE Abfrage scheitern — nicht
 * nur das eine Feld. Nachgemessen am 03.09.2026 an den Typen der Hooks:
 *
 *   characters, outfits, prompts        description, tags
 *   locations, pose_actions,
 *   fashion_assets                      description, category, tags
 *
 * Hier steht der SPALTENNAME und nicht ein „ja/nein": Heißt die Spalte anders,
 * benennt die Abfrage sie per Alias um, und die Oberfläche sieht überall
 * dasselbe Feld. Bis PROJ-52 war das nicht bloß Vorsorge — die Archetypen
 * nannten ihren Fließtext `short_description`.
 *
 * Ein Feld, das hier fehlt, wird schlicht nicht geladen und nicht durchsucht —
 * das ist der sichere Ausgang, kein stiller Fehler.
 */
export type SuchFelder = {
  /** Spalte mit dem Fließtext. */
  beschreibung?: string
  /** Spalte mit der Kategorie. Nur dort, wo es überhaupt eine gibt. */
  kategorie?: string
  /** Spalte mit den Schlagworten. */
  schlagworte?: string
}

export type Baustein = {
  schluessel: BausteinSchluessel
  /** Wie es im Menü heißt. */
  label: string
  /** Einzahl, für Sätze wie „Charakter suchen". */
  einzahl: string
  icon: LucideIcon
  /** Die Haupttabelle — daraus kommt die Auswahlliste. */
  tabelle: string
  /**
   * Wie die Spalte mit dem Anzeigenamen heißt.
   * Bei `prompts` ist es `title`, überall sonst `name`.
   */
  namensSpalte: 'name' | 'title'
  /**
   * Variantentabelle und ihr Fremdschlüssel — fehlt bei Prompts, dort hängen
   * die Bilder direkt am Eintrag.
   */
  varianten?: { tabelle: string; fk: string }
  /** Wohin die Bildzeile geschrieben wird. */
  bildTabelle: string
  /** Der Fremdschlüssel in der Bildtabelle. */
  bildFk: 'variant_id' | 'prompt_id'
  /** In welchen Speicher-Eimer die Datei kommt. */
  bucket: string
  /** Hat die Bildtabelle eine Spalte `storage_path`? prompt_media nicht. */
  hatStoragePath: boolean
  /** Feste Zusatzfelder beim Einfügen — `prompt_media` verlangt `type`. */
  zusatz?: Record<string, unknown>
  /** Welche Zusatzspalten es gibt — siehe {@link SuchFelder}. */
  suchFelder: SuchFelder
  /** Wohin in der App, um das Ergebnis anzusehen. */
  href: string
}

/**
 * Wie groß eine Datei je Eimer sein darf — in Megabyte.
 *
 * WARUM DAS HIER STEHT, OBWOHL ES EIGENTLICH IN SUPABASE STEHT: Der Browser
 * kann `storage.buckets` nicht einfach abfragen (dafür bräuchte es Rechte, die
 * ein angemeldeter Nutzer nicht hat). Diese Zahlen sind deshalb eine KOPIE,
 * keine Quelle — die Quelle bleibt Supabase.
 *
 * WARUM ES SIE TROTZDEM BRAUCHT: Am 03.09.2026 ist Mark genau hier
 * hineingelaufen. Er hatte ein Referenzsheet 4× vergrößern lassen (SeedVR2,
 * verlustfrei) — 6784×3712, 28,1 MB. `character-images` liess damals nur
 * 20 MB zu. Ohne diese Tabelle waere die einzige Meldung Supabases eigener,
 * englischer Satz gewesen ("The object exceeded the maximum allowed size"),
 * ohne Zahl und ohne zu sagen, WESSEN Grenze das ist.
 *
 * Die fuenf Eimer, in die ein vergroessertes Ergebnis uebernommen werden kann,
 * wurden am selben Tag von 10/20 MB auf 50 MB angehoben — 28 MB war schon
 * knapp am damaligen Limit, und SeedVR2 kann je nach Quellbild noch groesser
 * werden. `prompt-media` (Video, 100 MB) braucht keinen Eintrag.
 */
export const SPEICHERLIMIT_MB: Record<string, number> = {
  'character-images':  50,
  'outfit-images':     50,
  'fashion-assets':    50,
  'location-images':   50,
  'pose-action-images': 50,
}

/**
 * Passt eine Datei in den Eimer eines Bausteins? `null` heisst ja.
 *
 * WARUM CLIENTSEITIG UND NICHT ERST BEIM HOCHLADEN: Ohne diese Pruefung
 * erfaehrt man es erst nach dem vollen Hochladeversuch — bei 28 MB auf einer
 * gewoehnlichen Leitung ist das keine Sekunde, sondern eine spuerbare Wartezeit
 * fuer eine Meldung, die man auch sofort haette geben koennen.
 */
export function pruefeBildgroesse(bytes: number, b: Baustein): string | null {
  const limit = SPEICHERLIMIT_MB[b.bucket]
  if (!limit) return null
  const mb = bytes / 1024 / 1024
  if (mb <= limit) return null
  return `Das Bild ist ${mb.toFixed(1)} MB groß — ${b.label} erlaubt höchstens ${limit} MB.`
}

export const BAUSTEINE: Baustein[] = [
  {
    schluessel: 'charaktere', label: 'Charaktere', einzahl: 'Charakter', icon: Users,
    tabelle: 'characters', namensSpalte: 'name',
    varianten: { tabelle: 'character_variants', fk: 'character_id' },
    bildTabelle: 'character_images', bildFk: 'variant_id',
    bucket: 'character-images', hatStoragePath: true,
    suchFelder: { beschreibung: 'description', schlagworte: 'tags' },
    href: '/characters',
  },
  {
    schluessel: 'outfits', label: 'Outfits', einzahl: 'Outfit', icon: Shirt,
    tabelle: 'outfits', namensSpalte: 'name',
    varianten: { tabelle: 'outfit_variants', fk: 'outfit_id' },
    bildTabelle: 'outfit_images', bildFk: 'variant_id',
    bucket: 'outfit-images', hatStoragePath: true,
    suchFelder: { beschreibung: 'description', schlagworte: 'tags' },
    href: '/outfits',
  },
  {
    schluessel: 'fashion', label: 'Fashion', einzahl: 'Fashion Asset', icon: ShoppingBag,
    tabelle: 'fashion_assets', namensSpalte: 'name',
    varianten: { tabelle: 'fashion_asset_variants', fk: 'asset_id' },
    bildTabelle: 'fashion_asset_images', bildFk: 'variant_id',
    bucket: 'fashion-assets', hatStoragePath: true,
    suchFelder: { beschreibung: 'description', kategorie: 'category', schlagworte: 'tags' },
    href: '/fashion-assets',
  },
  {
    schluessel: 'locations', label: 'Locations', einzahl: 'Location', icon: MapPin,
    tabelle: 'locations', namensSpalte: 'name',
    varianten: { tabelle: 'location_variants', fk: 'location_id' },
    bildTabelle: 'location_images', bildFk: 'variant_id',
    bucket: 'location-images', hatStoragePath: true,
    suchFelder: { beschreibung: 'description', kategorie: 'category', schlagworte: 'tags' },
    href: '/locations',
  },
  {
    schluessel: 'posen', label: 'Posen', einzahl: 'Pose', icon: Drama,
    tabelle: 'pose_actions', namensSpalte: 'name',
    varianten: { tabelle: 'pose_action_variants', fk: 'pose_action_id' },
    bildTabelle: 'pose_action_images', bildFk: 'variant_id',
    bucket: 'pose-action-images', hatStoragePath: true,
    suchFelder: { beschreibung: 'description', kategorie: 'category', schlagworte: 'tags' },
    href: '/pose-actions',
  },

  // Prompts: Bilder hängen am Prompt, die Tabelle kennt keinen Speicherpfad
  // und verlangt ein `type` — beides steht hier, nicht als Sonderfall im Code.
  {
    schluessel: 'prompts', label: 'Prompts', einzahl: 'Prompt', icon: FileText,
    tabelle: 'prompts', namensSpalte: 'title',
    bildTabelle: 'prompt_media', bildFk: 'prompt_id',
    bucket: 'prompt-media', hatStoragePath: false,
    zusatz: { type: 'image' },
    // Prompts haben `description` und `tags`, aber KEINE `category`.
    suchFelder: { beschreibung: 'description', schlagworte: 'tags' },
    href: '/',
  },

  // Hier standen bis PROJ-52 die drei Archetyp-Bausteine. Sie waren die
  // einzigen ohne Variantentabelle und die einzigen mit `short_description`
  // statt `description` — beide Sonderfälle sind mit ihnen entfallen. Die
  // Felder `varianten?` und der Alias in `auswahlSpalten` bleiben trotzdem:
  // `prompts` braucht sie weiterhin.
]

export function baustein(schluessel: BausteinSchluessel): Baustein {
  const b = BAUSTEINE.find(x => x.schluessel === schluessel)
  if (!b) throw new Error(`Unbekannter Baustein: ${schluessel}`)
  return b
}

/**
 * Der Ablagepfad einer übernommenen Datei.
 *
 * Einheitlich, obwohl die vorhandenen Wege sich unterscheiden. Gefahrlos, weil
 * über die Spalte `storage_path` gelöscht wird und nicht über einen aus
 * Kennungen zusammengebauten Pfad — nachgemessen in allen Hooks.
 *
 * Der erste Ordner MUSS die Nutzerkennung sein: Genau darauf prüfen die
 * Speicherregeln (`storage.foldername(name)[1] = auth.uid()`).
 */
export function ablagepfad(
  userId: string, parentId: string, variantId: string | null, endung: string,
): string {
  const marke = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const mitte = variantId ? `${parentId}/${variantId}` : parentId
  return `${userId}/${mitte}/${marke}.${endung}`
}

// ─── Finden statt scrollen (PROJ-46) ────────────────────────────────────────

/**
 * Ein Eintrag, so wie ihn die Suche sieht.
 *
 * Absichtlich kleiner als der Eintrag aus dem Hook: Was hier nicht steht, kann
 * die Suche auch nicht heimlich benutzen. Alle Zusatzfelder sind optional —
 * ein Baustein ohne Kategorie liefert schlicht keine.
 */
export type SuchbarerEintrag = {
  name: string
  description?: string | null
  category?: string | null
  tags?: string[] | null
}

/**
 * Die Spaltenliste für die Abfrage, aus den Feldern des Bausteins.
 *
 * `prompts` nennt den Namen `title` — das wird per Alias auf `name` gebogen,
 * damit die Oberfläche überall dasselbe sieht. Derselbe Alias-Weg steht für
 * den Fließtext bereit; bis PROJ-52 brauchten ihn die Archetypen mit ihrer
 * `short_description`.
 *
 * Eigene Funktion und kein String im Hook, weil genau hier der Fallstrick
 * sitzt: EINE nicht vorhandene Spalte lässt die ganze Abfrage scheitern und
 * die Liste bleibt leer. Als Funktion ist sie prüfbar.
 */
export function auswahlSpalten(b: Baustein): string {
  const teile = ['id']
  teile.push(b.namensSpalte === 'title' ? 'name:title' : 'name')
  teile.push('cover_image_url')
  const { beschreibung, kategorie, schlagworte } = b.suchFelder
  if (beschreibung) {
    teile.push(beschreibung === 'description' ? 'description' : `description:${beschreibung}`)
  }
  if (kategorie) {
    teile.push(kategorie === 'category' ? 'category' : `category:${kategorie}`)
  }
  if (schlagworte) {
    teile.push(schlagworte === 'tags' ? 'tags' : `tags:${schlagworte}`)
  }
  return teile.join(', ')
}

/**
 * Text auf eine vergleichbare Form bringen.
 *
 * Kleinschreibung, und die deutschen Umlaute auf ihre Ersatzschreibung — so
 * findet „moenchengladbach" denselben Eintrag wie „Mönchengladbach". Der Weg
 * geht nur in DIESE Richtung: ae→ä zurückzuraten wäre falsch, sobald ein Wort
 * das „ae" wirklich meint.
 *
 * Das anschließende Zerlegen (NFD) räumt übrige Akzente weg, damit „Café"
 * auch als „cafe" gefunden wird.
 */
function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Passt der Eintrag zur Eingabe?
 *
 * WORTWEISE, NICHT ALS ZEICHENKETTE. Mark benennt seine Bausteine beschreibend:
 * „Arme verschränkt, Blick nach unten, sitzend". Wer „sitzend arme" eintippt,
 * meint genau diesen Eintrag — die bisherige Suche über `includes()` auf dem
 * ganzen Text fand ihn nie, weil die Wörter in anderer Reihenfolge stehen.
 *
 * Die Regel: JEDES eingetippte Wort muss irgendwo vorkommen, die Reihenfolge
 * ist egal, Groß- und Kleinschreibung auch. Innerhalb eines Wortes gilt
 * weiterhin Teiltreffer — sonst fände „gladbach" den BORUSSIA-PARK in
 * Mönchengladbach nicht.
 *
 * Gesucht wird über Name, Beschreibung, Kategorie und Schlagworte. Eine leere
 * Eingabe passt auf alles — kein Filter ist kein Filter.
 */
export function passtZurSuche(eintrag: SuchbarerEintrag, suche: string): boolean {
  const woerter = normalisiere(suche).split(/\s+/).filter(Boolean)
  if (woerter.length === 0) return true
  const heuhaufen = normalisiere([
    eintrag.name ?? '',
    eintrag.description ?? '',
    eintrag.category ?? '',
    ...(eintrag.tags ?? []),
  ].join(' '))
  return woerter.every(wort => heuhaufen.includes(wort))
}

/**
 * Welche Kategorien in einer Liste vorkommen — mit Anzahl, häufigste zuerst.
 *
 * Die Anzahl steht ABSICHTLICH neben dem Namen: Bei Marks Locations liegen
 * hinter „stadien_deutschland" 31 Einträge und hinter „natur" zehn. Ohne die
 * Zahl klickt man blind und landet wieder im Scrollen.
 *
 * Gleich häufige Kategorien stehen alphabetisch — sonst wackelt die Reihenfolge
 * je nach Ladereihenfolge der Daten, und wer einmal weiß, wo „natur" steht,
 * fände es beim nächsten Öffnen woanders.
 */
export function kategorien(
  eintraege: SuchbarerEintrag[],
): Array<{ wert: string; anzahl: number }> {
  const zaehler = new Map<string, number>()
  for (const e of eintraege) {
    const wert = e.category?.trim()
    if (!wert) continue
    zaehler.set(wert, (zaehler.get(wert) ?? 0) + 1)
  }
  return [...zaehler.entries()]
    .map(([wert, anzahl]) => ({ wert, anzahl }))
    .sort((a, b) => b.anzahl - a.anzahl || a.wert.localeCompare(b.wert, 'de'))
}

/**
 * Feste Kategorien, deren technischer Schlüssel einen Umlaut ersetzt.
 *
 * Nur diese eine Ausnahme, und keine allgemeine Regel „ae wird ä": Marks
 * eigene Kategorien (PROJ-34) dürfen alles heißen, und aus „aerial" würde
 * sonst „ärial".
 */
const LESBARE_KATEGORIE: Record<string, string> = {
  gebaeude: 'Gebäude',
}

/**
 * Der technische Kategoriewert als lesbare Beschriftung.
 *
 * In der Datenbank steht „stadien_deutschland" — auf dem Knopf steht „Stadien
 * Deutschland". Die Werte selbst bleiben unangetastet; das ist reine Anzeige.
 */
export function kategorieLabel(wert: string): string {
  const fest = LESBARE_KATEGORIE[wert]
  if (fest) return fest
  return wert
    .split(/[_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
