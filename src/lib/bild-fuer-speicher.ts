import { typAusBytes, endungFuerTyp } from './bildtyp'
import { zielMasse, lohntSich, istBewegt, kandidat } from './speicher-regeln'

/**
 * Ein Bild für den Speicher vorbereiten — im Browser, VOR dem Hochladen.
 *
 * WARUM: Seit dem 15.09.2026 liegen alle großen Bilder als WebP ≤ 2048 px in
 * Supabase (329 MB statt voll). Ohne diesen Schritt füllte jeder Upload den
 * Speicher wieder mit Originalen. Die Regeln stehen in `speicher-regeln.ts`.
 *
 * WAS UNVERÄNDERT DURCHGEHT — nie ein Fehler, immer das Original:
 *  · alles, was kein PNG oder JPEG ist: Videos in den Prompt-Medien, GIF, WebP,
 *    AVIF, HEIC — wie beim Umzug (`speicher-regeln.ts`, `kandidat`);
 *  · Dateien unter 300 KB;
 *  · bewegte PNG (APNG) — Canvas behielte nur das erste Einzelbild;
 *  · Bilder über 120 Megapixel (siehe `HOECHSTPIXEL`);
 *  · was der Browser nicht dekodieren kann, oder wenn die Maße nach dem
 *    Dekodieren nicht zum Dateikopf passen (siehe unten, Drehung);
 *  · wenn der Browser kein WebP erzeugt (älteres Safari liefert dann PNG);
 *  · wenn WebP keine 30 % spart.
 * Ein Upload darf an der Verkleinerung NIE scheitern: Lieber ein großes Bild
 * im Speicher als ein verlorenes.
 *
 * KEIN ZWEITES ORIGINAL: Das Original eines Web-Uploads geht in dieser Stufe
 * nicht nach Backblaze. Web-Uploads sind selten 4K, und ein Backblaze-Schlüssel
 * gehört nicht in den Browser (Marks Entscheidung, 15.09.2026). Genau deshalb
 * darf hier nichts falsch gedreht oder abgeschnitten werden — es gibt kein
 * Original, aus dem man es zurückholen könnte.
 */

export type SpeicherBild = {
  blob: Blob
  /** Was die Bytes tatsächlich sind. */
  typ: string
  /** Endung passend zum Ergebnis, ohne Punkt. */
  endung: string
  umgewandelt: boolean
  /** Ein Satz fürs Protokoll. */
  grund: string
}

/** Ein dekodiertes Bild. `kodieren` liefert WebP (oder, was der Browser kann). */
export type Dekodiert = {
  breite: number
  hoehe: number
  kodieren: (breite: number, hoehe: number, qualitaet: number) => Promise<Blob | null>
  freigeben: () => void
}

export type Masse = { breite: number; hoehe: number }

/**
 * Austauschbar, damit sich die Entscheidungen ohne Canvas prüfen lassen.
 *
 * `ziel`: Ist es gesetzt, soll gleich in dieser Größe dekodiert werden — die
 * Maße sind die NACH der EXIF-Drehung.
 */
export type BildUmgebung = {
  dekodieren: (blob: Blob, ziel: Masse | null) => Promise<Dekodiert | null>
}

export type Vorbereitung = {
  /** Endung aus dem Dateinamen — Rückfall für alles, was kein Bild ist. */
  nameEndung?: string | null
  umgebung?: BildUmgebung
}

/**
 * Über dieser Pixelzahl wird gar nicht erst dekodiert — das Bild geht unverändert hoch.
 *
 * WARUM 120 MP: Ein Bild wird im Browser als RGBA entpackt, 4 Bytes je Pixel.
 * Ein 50-MP-Handyfoto (8160×6120) sind so 200 MB, ein Panorama mit 120 MP schon
 * 480 MB — dort stürzen Tabs auf Handys und schwachen Rechnern ab. Bis zu dieser
 * Grenze wird deshalb DIREKT in Zielgröße dekodiert (`resizeWidth`), sodass nie
 * das volle Bild im Speicher liegt; darüber wäre schon der Dekodierer selbst ein
 * Risiko. Solche Dateien sind selten, und ein großer Upload ist das kleinere Übel
 * als ein abgestürzter Tab mitten im Speichern.
 */
export const HOECHSTPIXEL = 120_000_000

/** Bytes eines Blobs — `arrayBuffer` fehlt in manchen Umgebungen. */
async function bytesAus(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer())
  return new Promise((ja, nein) => {
    const leser = new FileReader()
    leser.onload = () => ja(new Uint8Array(leser.result as ArrayBuffer))
    leser.onerror = () => nein(leser.error)
    leser.readAsArrayBuffer(blob)
  })
}

function sauberEndung(roh: string | null | undefined): string | null {
  const e = (roh ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return e.length >= 2 && e.length <= 5 ? e : null
}

/**
 * Breite und Höhe aus dem DATEIKOPF — ohne das Bild zu dekodieren.
 *
 * PNG: IHDR-Block. JPEG: der erste SOF-Block, dazu die EXIF-Drehung (APP1);
 * bei den Drehungen 5–8 sind Breite und Höhe vertauscht. `null`, wenn der Kopf
 * das nicht hergibt — dann wird wie zuvor voll dekodiert.
 */
export function kopfMasse(b: Uint8Array): Masse | null {
  const u16 = (i: number, le = false) => (le ? b[i]! | (b[i + 1]! << 8) : (b[i]! << 8) | b[i + 1]!)
  const u32 = (i: number, le = false) =>
    (le ? (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) : ((b[i]! << 24) | (b[i + 1]! << 16) | (b[i + 2]! << 8) | b[i + 3]!)) >>> 0
  const gueltig = (m: Masse) => (m.breite > 0 && m.hoehe > 0 ? m : null)

  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      String.fromCharCode(b[12]!, b[13]!, b[14]!, b[15]!) === 'IHDR') {
    /*
      PNG MIT `eXIf` → KEINE VORAB-MASSE (Critic, 15.09.2026). Seit PNG 1.5 kann
      ein PNG eine EXIF-Drehung tragen, und Chrome wie Safari wenden sie an.
      Dieser Parser wertet sie nicht aus. Die Maße aus IHDR wären dann die
      UNGEDREHTEN — und eine Verkleinerung darauf verzerrte das Bild. Also:
      voll dekodieren, wie bei einem Kopf, den der Parser nicht kennt.
    */
    for (let i = 8; i + 8 <= b.length;) {
      const typ = String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!)
      if (typ === 'eXIf') return null
      if (typ === 'IDAT' || typ === 'IEND') break
      i += 12 + u32(i)
    }
    return gueltig({ breite: u32(16), hoehe: u32(20) })
  }

  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let drehung = 1
    let i = 2
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff) return null
      const marke = b[i + 1]!
      if (marke === 0xff) { i++; continue }
      if (marke === 0x01 || (marke >= 0xd0 && marke <= 0xd8)) { i += 2; continue }
      const laenge = u16(i + 2)
      if (marke === 0xe1 && i + 18 <= b.length &&
          String.fromCharCode(b[i + 4]!, b[i + 5]!, b[i + 6]!, b[i + 7]!) === 'Exif') {
        const tiff = i + 10
        const le = b[tiff] === 0x49
        const ifd = tiff + u32(tiff + 4, le)
        if (ifd + 2 <= b.length) {
          const anzahl = u16(ifd, le)
          for (let e = 0; e < anzahl && ifd + 2 + e * 12 + 12 <= b.length; e++) {
            const eintrag = ifd + 2 + e * 12
            if (u16(eintrag, le) === 0x0112) drehung = u16(eintrag + 8, le)
          }
        }
      }
      const sof = marke >= 0xc0 && marke <= 0xcf && marke !== 0xc4 && marke !== 0xc8 && marke !== 0xcc
      if (sof && i + 9 <= b.length) {
        const hoehe = u16(i + 5)
        const breite = u16(i + 7)
        return gueltig(drehung >= 5 && drehung <= 8 ? { breite: hoehe, hoehe: breite } : { breite, hoehe })
      }
      i += 2 + laenge
    }
  }
  return null
}

export async function bildFuerSpeicher(eingabe: Blob, optionen: Vorbereitung = {}): Promise<SpeicherBild> {
  // Nur der Anfang: Für Typ, Maße, EXIF-Drehung und APNG-Kennung reicht er
  // (`acTL` steht vor dem ersten `IDAT`). Ein 100-MB-Video soll nicht ganz in den
  // Speicher geladen werden, nur um festzustellen, dass es kein Bild ist.
  const bytes = await bytesAus(eingabe.slice(0, 256 * 1024))
  const echt = typAusBytes(bytes)

  const unveraendert = (grund: string): SpeicherBild => ({
    blob: eingabe,
    typ: echt ?? (eingabe.type || 'application/octet-stream'),
    endung: endungFuerTyp(echt) ?? sauberEndung(optionen.nameEndung) ?? endungFuerTyp(eingabe.type) ?? 'bin',
    umgewandelt: false,
    grund,
  })

  const pruefung = kandidat(echt, eingabe.size)
  if (!pruefung.ja) return unveraendert(`${pruefung.grund} — unverändert`)
  if (istBewegt(bytes)) return unveraendert('bewegtes PNG (APNG) — unverändert')

  const masse = kopfMasse(bytes)
  if (masse && masse.breite * masse.hoehe > HOECHSTPIXEL) {
    return unveraendert(`${masse.breite}×${masse.hoehe} ist über ${HOECHSTPIXEL / 1e6} MP — unverändert`)
  }
  const vorab = masse ? zielMasse(masse.breite, masse.hoehe) : null
  // Nur wenn wirklich verkleinert wird, gleich in Zielgröße dekodieren.
  const dekodierZiel = vorab?.verkleinert ? { breite: vorab.breite, hoehe: vorab.hoehe } : null

  const umgebung = optionen.umgebung ?? browserUmgebung()
  let bild: Dekodiert | null = null
  try {
    bild = await umgebung.dekodieren(eingabe, dekodierZiel)
  } catch {
    bild = null
  }
  if (!bild) return unveraendert(`${echt} lässt sich hier nicht dekodieren — unverändert`)

  try {
    /*
      MASSE GEGEN DEN KOPF PRÜFEN. Kommt etwas anderes heraus als erwartet, hat
      der Browser die EXIF-Drehung anders angewandt, als der Kopf sagt (oder die
      Zielgröße vor statt nach der Drehung genommen). Dann wird nicht geraten:
      Ein falsch gedrehtes Handyfoto bliebe für immer so, denn ein zweites
      Original gibt es nicht.

      DIE HÖHE BERECHNET DER BROWSER SELBST (Critic, 15.09.2026). Bis dahin
      bekam er Breite UND Höhe vorgegeben — dann lieferte er immer genau diese
      Maße, und diese Prüfung stimmte immer, auch bei einem ungedrehten und
      dadurch verzerrten Bild. Jetzt geht nur die Breite hin; die Höhe ergibt
      sich aus dem Seitenverhältnis dessen, was der Browser WIRKLICH dekodiert
      hat. Stimmt sie nicht mit dem Kopf überein, war die Drehung eine andere.
      ±1 px, weil Browser und `zielMasse` unterschiedlich runden dürfen.
    */
    const erwartet = dekodierZiel ?? masse
    const toleranz = dekodierZiel ? 1 : 0
    if (erwartet && (bild.breite !== erwartet.breite || Math.abs(bild.hoehe - erwartet.hoehe) > toleranz)) {
      return unveraendert(
        `Maße nach dem Dekodieren (${bild.breite}×${bild.hoehe}) passen nicht zu ${erwartet.breite}×${erwartet.hoehe} — unverändert`)
    }

    const ziel = zielMasse(bild.breite, bild.hoehe)
    const webp = await bild.kodieren(ziel.breite, ziel.hoehe, ziel.qualitaet)
    if (!webp) return unveraendert('WebP ließ sich nicht erzeugen — unverändert')
    if (typAusBytes((await bytesAus(webp.slice(0, 32)))) !== 'image/webp') {
      return unveraendert('der Browser erzeugt kein WebP — unverändert')
    }
    if (!lohntSich(eingabe.size, webp.size)) {
      return unveraendert(`WebP spart keine 30 % (${eingabe.size} → ${webp.size} Bytes) — unverändert`)
    }
    const von = masse ?? { breite: bild.breite, hoehe: bild.hoehe }
    return {
      blob: webp,
      typ: 'image/webp',
      endung: 'webp',
      umgewandelt: true,
      grund: `WebP ${ziel.qualitaet} · ${von.breite}×${von.hoehe} → ${ziel.breite}×${ziel.hoehe} · ` +
        `${Math.round(eingabe.size / 1024)} → ${Math.round(webp.size / 1024)} kB`,
    }
  } catch (e) {
    return unveraendert(`Umwandlung fehlgeschlagen (${(e as Error)?.message ?? e}) — unverändert`)
  } finally {
    bild.freigeben()
  }
}

// ─── Browser ─────────────────────────────────────────────────────────────────

type Leinwand = {
  zeichnen: (quelle: CanvasImageSource, breite: number, hoehe: number) => void
  quelle: CanvasImageSource
  alsBlob: (typ: string, qualitaet: number) => Promise<Blob | null>
}

function leinwand(breite: number, hoehe: number): Leinwand | null {
  if (typeof OffscreenCanvas !== 'undefined') {
    const c = new OffscreenCanvas(breite, hoehe)
    const ctx = c.getContext('2d')
    if (!ctx) return null
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    return {
      zeichnen: (q, b, h) => ctx.drawImage(q, 0, 0, b, h),
      quelle: c,
      alsBlob: (typ, qualitaet) => c.convertToBlob({ type: typ, quality: qualitaet }).catch(() => null),
    }
  }
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = breite
  c.height = hoehe
  const ctx = c.getContext('2d')
  if (!ctx) return null
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  return {
    zeichnen: (q, b, h) => ctx.drawImage(q, 0, 0, b, h),
    quelle: c,
    alsBlob: (typ, qualitaet) => new Promise(ja => c.toBlob(ja, typ, qualitaet)),
  }
}

/**
 * Canvas-Umgebung des Browsers.
 *
 * DIE DREHUNG WIRD AUSDRÜCKLICH ANGEFORDERT (`imageOrientation: 'from-image'`).
 * Hier stand bis zum 15.09.2026, `createImageBitmap` wende die EXIF-Drehung
 * „von selbst" an. Das stimmt nur in neueren Browsern; ältere lesen die Pixel
 * so, wie sie in der Datei stehen. Ein hochkant fotografiertes Handybild läge
 * dann quer im Speicher — dauerhaft, weil es kein zweites Original gibt.
 *
 * DIREKT IN ZIELBREITE (`resizeWidth`, ohne `resizeHeight`): Ein 50-MP-Foto
 * würde sonst voll entpackt (200 MB) und erst danach verkleinert. Die Höhe
 * rechnet der Browser selbst aus — daran prüft `bildFuerSpeicher`, ob die
 * Drehung so angewandt wurde, wie der Dateikopf sagt, und bleibt im Zweifel
 * beim Original.
 *
 * STUFENWEISE HALBIEREN, falls doch voll dekodiert wurde (kein Kopf lesbar):
 * Ein 4096er-Bild in einem Schritt auf 2048 zu zeichnen, lässt feine Linien
 * flimmern. Transparenz bleibt erhalten: Die Leinwand ist durchsichtig, WebP
 * kann Alpha.
 */
export function browserUmgebung(): BildUmgebung {
  return {
    async dekodieren(blob, ziel) {
      if (typeof createImageBitmap !== 'function') return null
      // Nur die Breite: Die Höhe soll der Browser aus dem GEDREHTEN Bild
      // berechnen — nur so verrät sie eine falsch angewandte Drehung.
      const bitmap = await createImageBitmap(blob, ziel
        ? { imageOrientation: 'from-image', resizeWidth: ziel.breite, resizeQuality: 'high' }
        : { imageOrientation: 'from-image' })
      return {
        breite: bitmap.width,
        hoehe: bitmap.height,
        freigeben: () => bitmap.close(),
        async kodieren(breite, hoehe, qualitaet) {
          let aktuell: CanvasImageSource = bitmap
          let b = bitmap.width
          let h = bitmap.height
          while (b / 2 >= breite && h / 2 >= hoehe) {
            const nb = Math.round(b / 2)
            const nh = Math.round(h / 2)
            const zwischen = leinwand(nb, nh)
            if (!zwischen) return null
            zwischen.zeichnen(aktuell, nb, nh)
            aktuell = zwischen.quelle
            b = nb
            h = nh
          }
          const ziel = leinwand(breite, hoehe)
          if (!ziel) return null
          ziel.zeichnen(aktuell, breite, hoehe)
          return ziel.alsBlob('image/webp', qualitaet / 100)
        },
      }
    },
  }
}
