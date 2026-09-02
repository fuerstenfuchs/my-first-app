'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { BAUSTEINE, ablagepfad, type Baustein, type BausteinSchluessel } from '@/lib/bausteine'

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
  /** Die Variante darin — null bei Archetypen und Prompts, die keine haben. */
  variantId: string | null
}

export type Eintrag = { id: string; name: string; cover_image_url: string | null }
export type Variante = { id: string; name: string; sort_order: number }

/** Die Dateiendung aus einem Speicherpfad — Vorgabe png. */
function endungAus(pfad: string): string {
  const m = /\.([a-z0-9]{2,5})$/i.exec(pfad)
  return m ? m[1].toLowerCase() : 'png'
}

export function useBildUebernehmen() {
  const [laeuft, setLaeuft] = useState(false)
  const supabase = createClient()

  /** Die Einträge eines Bausteins, für die Auswahlliste. */
  const eintraegeLaden = useCallback(async (b: Baustein): Promise<Eintrag[]> => {
    // `prompts` nennt die Spalte `title`, alle anderen `name`. Der Alias macht
    // daraus für die Oberfläche wieder einen einheitlichen `name`.
    const spalte = b.namensSpalte === 'title' ? 'name:title' : 'name'
    const { data, error } = await supabase
      .from(b.tabelle)
      .select(`id, ${spalte}, cover_image_url`)
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
    // Archetypen und Prompts haben keine Varianten — dort hängen die Bilder
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
   */
  const uebernehmen = useCallback(async (
    quellUrl: string, quellPfad: string, ziel: Ziel,
  ): Promise<boolean> => {
    const b = BAUSTEINE.find(x => x.schluessel === ziel.baustein)
    if (!b) { toast.error('Unbekanntes Ziel'); return false }

    setLaeuft(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Nicht angemeldet'); return false }

      // 1. Holen. Ohne Zwischenspeicher, damit ein gerade neu erzeugtes Bild
      //    nicht als alte Fassung aus dem Browser-Zwischenspeicher kommt.
      const antwort = await fetch(quellUrl, { cache: 'no-store' })
      if (!antwort.ok) {
        toast.error(`Bild konnte nicht geladen werden (HTTP ${antwort.status})`)
        return false
      }
      const blob = await antwort.blob()
      if (blob.size < 100) {
        toast.error('Das Bild ist leer — nicht übernommen.')
        return false
      }

      // 2. Ablegen, im Eimer des Bausteins.
      const pfad = ablagepfad(user.id, ziel.parentId, ziel.variantId, endungAus(quellUrl))
      // Woran die Bildzeile hängt: an der Variante, am Archetyp oder am Prompt.
      const anker = b.varianten ? ziel.variantId : ziel.parentId
      if (!anker) { toast.error('Kein Ziel für das Bild gefunden.'); return false }
      const { error: hochErr } = await supabase.storage
        .from(b.bucket)
        .upload(pfad, blob, { contentType: blob.type || 'image/png', upsert: false })
      if (hochErr) {
        toast.error(`Ablegen fehlgeschlagen: ${hochErr.message}`)
        return false
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
        await supabase.storage.from(b.bucket).remove([pfad])
        toast.error(`Eintragen fehlgeschlagen: ${zeileErr.message}`)
        return false
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
      toast.success(`Übernommen nach ${ziel.parentName}`, {
        description: `Als weiteres Bild hinzugefügt — das Titelbild bleibt unverändert.`,
      })
      return true
    } catch (e) {
      toast.error(`Übernehmen fehlgeschlagen: ${(e as Error).message}`)
      return false
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
