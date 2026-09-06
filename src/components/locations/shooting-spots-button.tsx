'use client'

import { useRef, useState } from 'react'
import { Images, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { groesseFuerFormat, promptFuerAuftrag } from '@/lib/image-generation'
import { SHOOTING_SPOTS, spotPrompt } from '@/lib/shooting-spots'
import type { Location } from '@/hooks/use-locations'

/**
 * „Vier Einzelbilder erzeugen" — die Shooting-Plätze als eigenständige Platten
 * (PROJ-74).
 *
 * VIER AUFTRÄGE, NICHT EIN AUFTRAG MIT VIER DURCHLÄUFEN. Dieselbe Bauart wie
 * bei der Einstellungsreihe: `anlegen()` nimmt EINEN Prompt und erzeugt ihn
 * `variants`-mal. Jeder Platz braucht aber einen anderen Prompt — „mit Tiefe"
 * und „Fläche" unterscheiden sich genau im Textbaustein. Vier Durchläufe eines
 * Auftrags gäben viermal denselben Platz.
 *
 * Nebeneffekt, der ohnehin gewollt ist: Ein misslungener Platz lässt sich
 * einzeln wiederholen, ohne die anderen drei noch einmal zu bezahlen.
 */
export function ShootingSpotsButton({ location }: { location: Location }) {
  const { anlegen } = useImageJobs(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState(0)

  /**
   * DIE SPERRE LIEGT IM REF, NICHT IM STATE. `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern — zwei schnelle Klicks kämen beide durch die Prüfung und
   * reihten acht Aufträge ein statt vier. Bei bezahlten Erzeugungen ist dieses
   * Fenster teuer, und genau dieser Fehler steht in `features/OFFEN.md`.
   */
  const laeuftRef = useRef(false)

  async function handleErzeugen() {
    if (laeuftRef.current) return
    if (!location.cover_image_url) return

    laeuftRef.current = true
    setLaeuft(true)
    setFortschritt(0)

    // Eine Kennung für alle vier. Der Lichttisch zeigt sie noch nicht
    // gruppiert — ohne sie wäre das später aber gar nicht mehr möglich.
    const reiheId = crypto.randomUUID()
    const zuordnung = groesseFuerFormat(null)
    let eingereiht = 0

    try {
      for (const [i, spot] of SHOOTING_SPOTS.entries()) {
        const job = await anlegen({
          prompt: promptFuerAuftrag(spotPrompt(spot, location), null, ['location']),
          model: 'gpt-image-2',
          size: zuordnung.size,
          aspect_ratio: null,
          variants: 1,
          ziel_klasse: null,
          reference_urls: [location.cover_image_url],
          reference_roles: ['location'],
          scene_meta: {
            name: `${location.name} — ${spot.label}`,
            herkunft: 'shooting-spots',
            location_id: location.id,
            spot: spot.key,
            reihe_id: reiheId,
            reihe_nr: i + 1,
            reihe_gesamt: SHOOTING_SPOTS.length,
          },
        })

        // Beim ersten Fehlschlag anhalten. `anlegen` meldet den Grund bereits
        // selbst; drei weitere gleichlautende Meldungen wären nur Lärm.
        if (!job) break
        eingereiht++
        setFortschritt(eingereiht)
      }
    } catch (e) {
      // OHNE DIESES `catch` WÄRE DER FEHLER UNSICHTBAR. `anlegen` fängt
      // Datenbankfehler selbst ab, aber `supabase.auth.getUser()` darin wirft
      // bei abgerissener Verbindung. `onClick` nimmt diese async-Funktion
      // direkt entgegen — die Ausnahme würde zu einer unbehandelten
      // Promise-Ablehnung: kein Toast, kein Fehlertext, der Knopf sieht danach
      // normal aus. Der naheliegende nächste Schritt wäre ein zweiter Klick
      // auf Aufträge, die schon laufen und bezahlt sind.
      toast.error(`Abgebrochen nach ${eingereiht} von ${SHOOTING_SPOTS.length}: ` +
                  `${(e as Error).message}`)
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
    }

    if (eingereiht > 0) {
      toast.success(
        eingereiht === SHOOTING_SPOTS.length
          ? `${eingereiht} Hintergründe eingereiht — sie stehen in der Warteschlange.`
          : `Nur ${eingereiht} von ${SHOOTING_SPOTS.length} eingereiht.`,
      )
    }
  }

  if (!location.cover_image_url) return null

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        className="w-full"
        onClick={handleErzeugen}
        disabled={laeuft}
      >
        {laeuft
          ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              {fortschritt}/{SHOOTING_SPOTS.length} eingereiht …</>
          : <><Images className="mr-1.5 h-3.5 w-3.5" />
              Die {SHOOTING_SPOTS.length} Plätze einzeln erzeugen</>}
      </Button>
      <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
        Statt eines Blattes vier vollformatige, leere Hintergründe:{' '}
        {SHOOTING_SPOTS.map(s => s.label).join(', ')}. Die kannst du einzeln als
        Referenz anhängen — beim Blatt weiß das Modell nicht, welches der sechs
        Felder gemeint ist. Kostet vier Erzeugungen.
      </p>
    </div>
  )
}
