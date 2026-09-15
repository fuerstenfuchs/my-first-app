'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import {
  BAUSTEINE, ablagepfad, auswahlSpalten, pruefeBildgroesse,
  type Baustein, type BausteinSchluessel,
} from '@/lib/bausteine'
import { bildEndung, bildTyp } from '@/lib/bildtyp'

/**
 * Ein fertiges Bild aus der Warteschlange in einen Baustein übernehmen.
 *
 * DAS BILD WIRD KOPIERT, NICHT VERLINKT — und das ist die eine Entscheidung,
 * die hier zählt.
 *
 * Es gäbe einen schnelleren Weg: `addImageUrl()` gibt es in allen fünf Hooks,
 * es hängt einem Baustein eine Bildadresse an, ohne ein Byte zu bewegen. Und
 * `generated-images` ist öffentlich lesbar, die Adresse würde also
 * funktionieren.
 *
 * Sie würde aber nur so lange funktionieren, wie der Auftrag existiert:
 * `use-image-jobs.ts` löscht beim Entfernen eines Auftrags dessen Dateien mit.
 * Das Bild im Charakter stürbe still mit — ein kaputtes Kästchen, ohne
 * Fehlermeldung, vielleicht erst Wochen später bemerkt.
 *
 * Der Preis des Kopierens ist Speicherplatz (ein paar MB je Bild). Der Gewinn
 * ist, dass nichts unbemerkt kaputtgeht.
 */

export type Ziel = {
  baustein: BausteinSchluessel
  /** Der vorhandene Eintrag, in den es soll. */
  parentId: string
  parentName: string
  /** Die Variante darin — null bei Prompts, die keine haben. */
  variantId: string | null
  /**
   * Keine eigene Erfolgsmeldung zeigen.
   *
   * Für Abläufe, die `uebernehmen` nur als Zwischenschritt benutzen und danach
   * selbst zusammenfassen. Der Titelbild-Knopf (PROJ-51) braucht das: Dessen
   * Zweck IST das Ersetzen des Titelbildes, während die Meldung hier wörtlich
   * „das Titelbild bleibt unverändert" verspricht. Beides nacheinander an
   * derselben Stelle des Bildschirms — und eine der beiden Aussagen ist
   * jedes Mal falsch.
   */
  stillLeise?: boolean
}

/**
 * Ein Eintrag der Auswahlliste.
 *
 * Die drei Zusatzfelder sind optional, weil nicht jeder Baustein sie hat —
 * welcher welche hat, steht in `BAUSTEINE.suchFelder` und nicht hier.
 */
export type Eintrag = {
  id: string
  name: string
  cover_image_url: string | null
  description?: string | null
  category?: string | null
  tags?: string[] | null
}
export type Variante = { id: string; name: string; sort_order: number }

/**
 * Die Dateiendung der Kopie — aus den BYTES des geholten Bildes.
 *
 * WARUM NICHT MEHR AUS DEM PFAD: Mark hat am 15.09.2026 entschieden, große
 * Bilder an derselben Adresse durch WebP zu ersetzen; `0.png` in
 * generated-images kann dann WebP enthalten. Aus dem Pfad gelesen, bekäme die
 * Kopie im Baustein wieder `.png` — und trüge den falschen Namen weiter.
 * Reihenfolge und Rückfall stehen in `bildEndung` (`src/lib/bildtyp.ts`).
 */
async function artAus(blob: Blob): Promise<{ endung: string; typ: string }> {
  // Endung UND Typ aus denselben Bytes (15.09.2026, Critic S1): Kam nur die
  // Endung aus den Bytes und der Typ aus `blob.type`, hieß die Kopie `.webp`
  // und lag als `image/png` im Speicher — der Kopf einer ausgetauschten Datei
  // meldet bis zu einer Stunde lang noch den alten Typ.
  const kopf = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
  return { endung: bildEndung(kopf, blob.type, 'png'), typ: bildTyp(kopf, blob.type, 'image/png') }
}

export function useBildUebernehmen() {
  const [laeuft, setLaeuft] = useState(false)
  const supabase = createClient()

  /** Die Einträge eines Bausteins, für die Auswahlliste. */
  const eintraegeLaden = useCallback(async (b: Baustein): Promise<Eintrag[]> => {
    // Welche Spalten es gibt, steht am Baustein — samt der Umbenennungen
    // (`title` → `name`, `short_description` → `description`). Eine Spalte, die
    // es in der Tabelle nicht gibt, ließe die GANZE Abfrage scheitern und die
    // Liste bliebe wortlos leer. Deshalb wird hier nichts geraten.
    const { data, error } = await supabase
      .from(b.tabelle)
      .select(auswahlSpalten(b))
      .order(b.namensSpalte, { ascending: true })
      .limit(500)
    if (error) {
      toast.error(`${b.label} konnten nicht geladen werden: ${error.message}`)
      return []
    }
    return (data ?? []) as unknown as Eintrag[]
  }, [supabase])

  const variantenLaden = useCallback(async (
    b: Baustein, parentId: string,
  ): Promise<Variante[]> => {
    // Prompts haben keine Varianten — dort hängen die Bilder
    // direkt am Eintrag. Eine leere Liste heißt hier also NICHT „geht nicht".
    if (!b.varianten) return []
    const { data, error } = await supabase
      .from(b.varianten.tabelle)
      .select('id, name, sort_order')
      .eq(b.varianten.fk, parentId)
      .order('sort_order', { ascending: true })
    if (error) {
      toast.error(`Varianten konnten nicht geladen werden: ${error.message}`)
      return []
    }
    return (data ?? []) as Variante[]
  }, [supabase])

  /**
   * Das eigentliche Übernehmen.
   *
   * `quellUrl` ist die öffentliche Adresse des Ergebnisbildes. Sie wird
   * heruntergeladen und in den Eimer des Bausteins hochgeladen — danach hat
   * der Baustein sein eigenes Exemplar.
   *
   * LIEFERT DIE ADRESSE DER KOPIE, bei Misserfolg `null` (bis 15.09.2026 nur
   * ja/nein). Die Ablage-Wache setzt damit das Titelbild auf die Kopie statt
   * auf die Auftragsdatei in generated-images — sonst hinge das Titelbild am
   * Auftrag, und genau das soll das Kopieren verhindern. Alle übrigen Aufrufer
   * prüfen nur, OB etwas zurückkam; für sie ändert sich nichts.
   */
  const uebernehmen = useCallback(async (
    quellUrl: string, quellPfad: string, ziel: Ziel,
  ): Promise<string | null> => {
    const b = BAUSTEINE.find(x => x.schluessel === ziel.baustein)
    if (!b) { toast.error('Unbekanntes Ziel'); return null }

    setLaeuft(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return null }

      // 1. Holen. Ohne Zwischenspeicher, damit ein gerade neu erzeugtes Bild
      //    nicht als alte Fassung aus dem Browser-Zwischenspeicher kommt.
      const antwort = await fetch(quellUrl, { cache: 'no-store' })
      if (!antwort.ok) {
        toast.error(`Bild konnte nicht geladen werden (HTTP ${antwort.status})`)
        return null
      }
      const blob = await antwort.blob()
      if (blob.size < 100) {
        toast.error('Das Bild ist leer — nicht übernommen.')
        return null
      }

      // Bevor irgendetwas hochgeladen wird: Passt es überhaupt in den Eimer?
      // Ohne diese Prüfung erführe man es erst nach dem vollen Upload-Versuch —
      // bei einem vergrößerten Ergebnis (20–30 MB) eine spürbare Wartezeit für
      // eine Meldung, die sofort dagewesen wäre. Am 03.09.2026 gefunden: Ein
      // 4×-vergrößertes Referenzsheet (28,1 MB) passte nicht in
      // `character-images` (damals 20 MB) und Supabase antwortete nur auf
      // Englisch, ohne Zahl.
      const zuGross = pruefeBildgroesse(blob.size, b)
      if (zuGross) {
        toast.error(zuGross)
        return null
      }

      // 2. Ablegen, im Eimer des Bausteins.
      const bildArt = await artAus(blob)
      const pfad = ablagepfad(user.id, ziel.parentId, ziel.variantId, bildArt.endung)
      // Woran die Bildzeile hängt: an der Variante oder am Prompt.
      const anker = b.varianten ? ziel.variantId : ziel.parentId
      if (!anker) { toast.error('Kein Ziel für das Bild gefunden.'); return null }
      const { error: hochErr } = await supabase.storage
        .from(b.bucket)
        .upload(pfad, blob, { contentType: bildArt.typ, upsert: false })
      if (hochErr) {
        // Falls die Tabelle in bausteine.ts und die Grenze in Supabase je
        // auseinanderlaufen (die eine ist eine Kopie der anderen — siehe
        // SPEICHERLIMIT_MB), fängt das hier den Fall trotzdem lesbar auf.
        const klingtNachGroesse = /exceed|maximum|too large|payload/i.test(hochErr.message)
        toast.error(klingtNachGroesse
          ? `Das Bild ist zu groß für ${b.label} (${(blob.size / 1024 / 1024).toFixed(1)} MB).`
          : `Ablegen fehlgeschlagen: ${hochErr.message}`)
        return null
      }

      const { data: { publicUrl } } = supabase.storage.from(b.bucket).getPublicUrl(pfad)

      // 3. Ans Ende der vorhandenen Bilder hängen.
      const { data: letzte } = await supabase
        .from(b.bildTabelle)
        .select('sort_order')
        .eq(b.bildFk, anker)
        .order('sort_order', { ascending: false })
        .limit(1)
      const naechste = ((letzte?.[0]?.sort_order as number | undefined) ?? -1) + 1

      const { error: zeileErr } = await supabase.from(b.bildTabelle).insert({
        [b.bildFk]: anker,
        user_id: user.id,
        url: publicUrl,
        // `prompt_media` hat diese Spalte nicht — sie einfach mitzuschicken
        // wäre ein Fehler, kein stiller Zusatz.
        ...(b.hatStoragePath ? { storage_path: pfad } : {}),
        sort_order: naechste,
        ...(b.zusatz ?? {}),
      })
      if (zeileErr) {
        // Die Datei liegt schon im Eimer — ohne Zeile wüsste niemand mehr,
        // wozu sie gehört. Also wieder wegräumen.
        //
        // RÜCKBAU OHNE ZÄHLUNG, BEWUSST: Die Datei wurde Sekunden zuvor unter
        // einem frischen Pfad (Zeitstempel + Zufall, `upsert: false`) von hier
        // hochgeladen, und die Zeile, die auf sie zeigen sollte, kam nie an.
        // Niemand sonst kann schon auf sie verweisen.
        // `speicher-loeschstellen.test.ts` lässt diese Stelle deshalb zu.
        await supabase.storage.from(b.bucket).remove([pfad])
        toast.error(`Eintragen fehlgeschlagen: ${zeileErr.message}`)
        return null
      }

      // Notiz, dass dieses Ergebnisbild abgelegt ist — damit der Lichttisch es
      // markieren kann. Reine Anzeige-Hilfe: Scheitert sie, ist trotzdem alles
      // gut gegangen, deshalb nur eine Zeile im Protokoll und keine Fehlermeldung.
      const { error: notizErr } = await supabase.from('bild_uebernahmen').upsert({
        user_id: user.id,
        quell_pfad: quellPfad,
        ziel_art: ziel.baustein,
        ziel_id: ziel.parentId,
        ziel_name: ziel.parentName,
      }, { onConflict: 'user_id,quell_pfad,ziel_art,ziel_id' })
      if (notizErr) console.warn('Übernahme-Notiz nicht gespeichert:', notizErr.message)

      // Das Titelbild wird ABSICHTLICH nicht angefasst — auch dann nicht, wenn
      // der Baustein noch keines hat. Mark am 02.09.2026: „Da habe ich mühsam
      // schon eigene Titelbilder erstellt, sodass die möglichst alle gleich
      // aussehen." Ein übernommenes Bild ist immer nur ein weiteres Bild.
      if (!ziel.stillLeise) {
        toast.success(`Übernommen nach ${ziel.parentName}`, {
          description: `Als weiteres Bild hinzugefügt — das Titelbild bleibt unverändert.`,
        })
      }
      return publicUrl
    } catch (e) {
      toast.error(`Übernehmen fehlgeschlagen: ${(e as Error).message}`)
      return null
    } finally {
      setLaeuft(false)
    }
  }, [supabase])

  /**
   * Welche Ergebnisbilder schon abgelegt sind — als Menge von Speicherpfaden.
   *
   * Der Pfad und nicht die Adresse: Die Adresse trägt in der Warteschlange
   * einen Cache-Brecher (`?v=`), der sich mit jedem Versuch ändert.
   */
  const abgelegteLaden = useCallback(async (): Promise<Set<string>> => {
    const { data, error } = await supabase
      .from('bild_uebernahmen')
      .select('quell_pfad')
      .limit(2000)
    if (error) return new Set()
    return new Set((data ?? []).map(r => r.quell_pfad as string))
  }, [supabase])

  return { laeuft, eintraegeLaden, variantenLaden, uebernehmen, abgelegteLaden }
}
