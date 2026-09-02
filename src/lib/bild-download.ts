/**
 * Ein Bild direkt herunterladen, ohne Umweg über einen neuen Tab.
 *
 * Warum nicht einfach <a href={url} download>: Das Attribut `download` wirkt
 * nur bei gleicher Herkunft. Die Bilder liegen bei Supabase, also auf einer
 * anderen Domain — der Browser ignoriert `download` und öffnet das Bild
 * stattdessen im Tab. Deshalb wird die Datei geholt und als Blob mit eigener
 * Adresse verlinkt; die hat dieselbe Herkunft wie die Seite und wird gespeichert.
 *
 * Wohin gespeichert wird, entscheidet der Browser, nicht die Seite: in den
 * eingestellten Download-Ordner, ohne Nachfrage, solange in den
 * Browser-Einstellungen nicht „Vor dem Download fragen" aktiv ist.
 */
export async function bildHerunterladen(url: string, dateiname: string): Promise<void> {
  const antwort = await fetch(url)
  if (!antwort.ok) {
    throw new Error(`Bild nicht erreichbar (HTTP ${antwort.status})`)
  }
  const blob = await antwort.blob()
  const blobUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = dateiname
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Erst freigeben, wenn der Browser den Download übernommen hat.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  }
}

/**
 * Sprechender Dateiname statt „0.png".
 * Beispiel: tresor-2026-09-01-1712-netflix-drama-1.png
 */
export function dateinameFuerBild(
  erstelltAm: string, index: number, gesamt: number, hinweis?: string | null,
  /**
   * Der Speicherpfad des Bildes — nur wegen der Endung.
   *
   * Vorher stand hier fest `.png`. Seit Gemini dabei ist, liegen auch JPEGs in
   * der Ablage; `ergebnisAblegen` im Arbeiter bestimmt Endung und Typ eigens
   * aus dem Inhalt. Ohne diesen Parameter hätte der Download das wieder
   * ausgehebelt und JPEG-Bytes als `.png` gespeichert — genau der Fehler, gegen
   * den die Ablage repariert wurde.
   */
  pfad?: string | null,
): string {
  const d = new Date(erstelltAm)
  const zwei = (n: number) => String(n).padStart(2, '0')
  const stempel =
    `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}` +
    `-${zwei(d.getHours())}${zwei(d.getMinutes())}`

  const teile = ['tresor', stempel]
  if (hinweis) {
    const sauber = hinweis
      .toLowerCase()
      .replace(/[äöüß]/g, z => ({ ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' }[z] ?? z))
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
    if (sauber) teile.push(sauber)
  }
  if (gesamt > 1) teile.push(String(index + 1))

  // Endung aus dem Pfad, Rückfall png. Ein JPEG unter .png zeigt der Browser
  // richtig an (er rät), aber ein Bildprogramm oder eine Druckerei lehnt es ab.
  const endung = (pfad && /\.([a-z0-9]{2,5})$/i.exec(pfad)?.[1]?.toLowerCase()) || 'png'
  return `${teile.join('-')}.${endung}`
}
