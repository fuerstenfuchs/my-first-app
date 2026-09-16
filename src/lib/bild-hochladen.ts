import { bildFuerSpeicher, type SpeicherBild, type BildUmgebung } from './bild-fuer-speicher'

/**
 * DIE EINE STELLE, an der ein Bild aus dem Browser in einen Speicher-Eimer geht.
 *
 * WARUM EINE: Bis zum 15.09.2026 stand „hochladen" an fünfzehn Stellen, jede mit
 * eigener Endung aus dem Dateinamen und ohne Verkleinerung. Nach dem Umzug auf
 * WebP ≤ 2048 hätte jede davon den Speicher wieder mit Originalen gefüllt.
 * `speicher-uploadstellen.test.ts` wird rot, sobald irgendwo sonst direkt
 * hochgeladen wird.
 *
 * DER PFAD KOMMT ALS FUNKTION DER ENDUNG: Welche Endung eine Datei bekommt,
 * steht erst NACH dem Verkleinern fest (`.webp` oder das Original). Ein fest
 * zusammengesetzter Pfad trüge sonst `.png` vor WebP-Bytes — genau der Fehler,
 * gegen den die Bytes-Erkennung am selben Tag gebaut wurde.
 *
 * Diese Datei hat bewusst keinen `@/`-Import: Die Chrome-Erweiterung bindet sie
 * direkt ein (wie schon `analyse-prompts.ts`), mit ihrem eigenen Client.
 */

type Fehler = { message: string } | null

/** Nur, was die Funktion vom Supabase-Client braucht. */
export type HochladeZugang = {
  storage: {
    from: (bucket: string) => {
      upload: (
        pfad: string, daten: Blob, optionen: { contentType: string; upsert: boolean },
      ) => PromiseLike<{ error: Fehler }>
      getPublicUrl: (pfad: string) => { data: { publicUrl: string } }
    }
  }
}

export type Hochladeauftrag = {
  bucket: string
  /** Baut den Pfad aus der endgültigen Endung, z. B. `e => \`${uid}/${id}.${e}\``. */
  pfadFuer: (endung: string) => string
  /** Eine Datei (wird vorbereitet) oder ein schon vorbereitetes Bild. */
  datei: Blob | SpeicherBild
  upsert?: boolean
  /** Nur für Tests. */
  umgebung?: BildUmgebung
}

export type Hochladeergebnis =
  | { ok: true; pfad: string; url: string; bild: SpeicherBild }
  | { ok: false; pfad: string; fehler: string; bild: SpeicherBild }

function istVorbereitet(d: Blob | SpeicherBild): d is SpeicherBild {
  return typeof (d as SpeicherBild).umgewandelt === 'boolean' && (d as SpeicherBild).blob instanceof Blob
}

/** Bereitet vor (falls nötig), lädt hoch, liefert Pfad und öffentliche Adresse. */
export async function bildHochladen(zugang: HochladeZugang, auftrag: Hochladeauftrag): Promise<Hochladeergebnis> {
  const bild = istVorbereitet(auftrag.datei)
    ? auftrag.datei
    : await bildFuerSpeicher(auftrag.datei, {
        nameEndung: (auftrag.datei as File).name?.split('.').pop() ?? null,
        umgebung: auftrag.umgebung,
      })

  const pfad = auftrag.pfadFuer(bild.endung)
  const eimer = zugang.storage.from(auftrag.bucket)
  try {
    const { error } = await eimer.upload(pfad, bild.blob, {
      contentType: bild.typ,
      upsert: auftrag.upsert ?? false,
    })
    if (error) return { ok: false, pfad, fehler: error.message, bild }
  } catch (e) {
    return { ok: false, pfad, fehler: (e as Error)?.message ?? String(e), bild }
  }
  return { ok: true, pfad, url: eimer.getPublicUrl(pfad).data.publicUrl, bild }
}
