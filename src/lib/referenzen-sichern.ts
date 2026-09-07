import { istEigenerSpeicher } from '@/lib/referenzkette'

/**
 * Fremde Referenzbilder in den eigenen Speicher holen, bevor ein Auftrag
 * abgeschickt wird (PROJ-86).
 *
 * MARKS AUFTRAG vom 07.09.2026, wörtlich: „Das sollte finalisiert werden, dass
 * die Bilder auf jeden Fall genommen werden, egal wo sie herkommen und welche
 * Endung sie haben."
 *
 * WARUM DIE SCHRANKE ÜBERHAUPT DA IST — sie ist kein Schikane, sondern Absicht:
 * Der Arbeiter läuft auf Marks PC und erreicht damit alles in seinem Heimnetz.
 * Dürfte er beliebige Adressen abrufen, ließe sich über die Fehlermeldung in
 * der Warteschlange ausspähen, welche Geräte dort antworten. Die Schranke bleibt
 * deshalb, wo sie ist.
 *
 * Was sich ändert, ist der Weg davor: Statt den Auftrag scheitern zu lassen
 * (oder das Bild still wegzulassen), wird es vorher geholt und im eigenen
 * Speicher abgelegt — durch `/api/referenz-holen`, das serverseitig gegen SSRF
 * prüft und die Größe begrenzt.
 *
 * EIN KOMMENTAR, DER HIER FALSCH STAND: Bis zur Prüfung am 07.09.2026 behauptete
 * diese Stelle, die Route lese den Bildtyp an den ersten Bytes ab. Das tat sie
 * nicht — sie schaute allein auf den gemeldeten `Content-Type` und lehnte alles
 * ab, was nicht mit `image/` begann. Falsch eingerichtete S3-Eimer und CDNs
 * liefern ein gültiges JPEG aber regelmäßig als `application/octet-stream`.
 * Seit PROJ-89 stimmt der Satz: Sagt der Kopf nichts Brauchbares, entscheiden
 * die Bytes.
 *
 * ZUR ENDUNG, die Mark eigens genannt hat: Sie spielt an keiner Stelle eine
 * Rolle. Der Arbeiter prüft nur die Herkunft, und die Route leitet die Endung
 * aus dem erkannten Bildtyp ab (jpg, png, webp, gif, avif). Ein Bild ohne
 * Endung in der Adresse kommt genauso durch wie eines mit `.PNG`.
 */

export type Sicherung = {
  /** Die Adressen in derselben Reihenfolge — geholte ersetzt, eigene unberührt. */
  urls: string[]
  /** Wie viele wirklich geholt wurden. */
  geholt: number
  /** Adressen, die sich nicht holen ließen — meist abgelaufene Verweise. */
  gescheitert: string[]
}

/** Ein einzelnes Bild holen lassen. Gibt die neue Adresse oder null zurück. */
async function holen(url: string): Promise<string | null> {
  try {
    const antwort = await fetch('/api/referenz-holen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    if (!antwort.ok) return null
    const daten = await antwort.json() as { url?: unknown }
    return typeof daten.url === 'string' && daten.url.length > 0 ? daten.url : null
  } catch {
    // Netzfehler oder abgebrochene Antwort. Für den Aufrufer ist das dasselbe
    // wie „ließ sich nicht holen"; ein eigener Fall brächte ihm nichts.
    return null
  }
}

/**
 * Alle fremden Adressen einer Liste holen, die eigenen unangetastet lassen.
 *
 * DIE REIHENFOLGE BLEIBT ERHALTEN, und das ist keine Kleinigkeit: Die
 * Zuordnungszeilen im Prompt sagen „Image 1 = …, Image 2 = …". Käme die Liste
 * umsortiert zurück, trüge jedes Bild das falsche Etikett — und das sähe man
 * dem Ergebnis nicht als Fehler an.
 *
 * Was sich nicht holen lässt, BLEIBT in der Liste. Es an dieser Stelle
 * stillschweigend zu entfernen hieße, einen Auftrag mit weniger Referenzen
 * abzuschicken, als der Prompt beschreibt — der Aufrufer entscheidet, was er
 * damit macht.
 */
export async function referenzenSichern(urls: string[]): Promise<Sicherung> {
  const raus: string[] = []
  const gescheitert: string[] = []
  let geholt = 0

  for (const url of urls) {
    if (istEigenerSpeicher(url)) { raus.push(url); continue }
    const neu = await holen(url)
    if (neu) { raus.push(neu); geholt++ }
    else { raus.push(url); gescheitert.push(url) }
  }

  return { urls: raus, geholt, gescheitert }
}

/** Ein Satz für die Meldung — oder null, wenn nichts zu melden war. */
export function sicherungsMeldung(s: Sicherung): string | null {
  if (s.geholt === 0 && s.gescheitert.length === 0) return null
  const teile: string[] = []
  if (s.geholt > 0) {
    teile.push(s.geholt === 1
      ? 'Ein Referenzbild lag außerhalb und wurde in deinen Speicher geholt.'
      : `${s.geholt} Referenzbilder lagen außerhalb und wurden in deinen Speicher geholt.`)
  }
  if (s.gescheitert.length > 0) {
    teile.push(s.gescheitert.length === 1
      ? 'Eines ließ sich nicht holen — der Arbeiter wird es ablehnen.'
      : `${s.gescheitert.length} ließen sich nicht holen — der Arbeiter wird sie ablehnen.`)
  }
  return teile.join(' ')
}
