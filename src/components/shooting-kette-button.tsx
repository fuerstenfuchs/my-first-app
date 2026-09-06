'use client'

import { useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Shirt, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { useOutfits } from '@/hooks/use-outfits'
import { AssetPickerDialog } from '@/components/prompts/asset-picker-dialog'
import {
  groesseFuerFormat, promptFuerAuftrag,
  type ModellId, type KlassenId, type Referenz, type ReferenzRolle,
} from '@/lib/image-generation'
import { baueShooting, kettenAnsage, KETTE_VORGABE, type KettenOptionen } from '@/lib/shooting-kette'
import type { AspectRatioKey } from '@/lib/scene-builder-options'
import type { Scene } from '@/lib/szene-prompt'
import type { Outfit } from '@/hooks/use-outfits'

/**
 * „Shooting erzeugen" (PROJ-75) — ein ganzes Shooting an einem Ort.
 *
 * EIN BAUTEIL FÜR BEIDE WEGE. Mark auf die Frage, ob die Kette im Scene
 * Builder oder bei der Location beginnen soll: „werden mir beide Wege recht."
 * Also beide — aber nicht zweimal derselbe Code. Was hier steht, gilt an
 * beiden Stellen; der Unterschied ist nur, WOHER die Szene kommt.
 *
 * N AUFTRÄGE, NICHT EINER MIT N DURCHLÄUFEN. Dieselbe Bauart wie bei der
 * Einstellungsreihe (PROJ-44), aus demselben Grund: Platz, Einstellungsgröße
 * und Haltung stecken als Text im Prompt. Fünf Durchläufe eines Auftrags gäben
 * fünfmal dasselbe Bild.
 */
export function ShootingKetteButton({
  scene, referenzen, aspectRatio, sceneMeta,
  // Beide Einstiege erzeugen mit derselben Vorgabe wie der Auftragsknopf
  // daneben. Wer ein anderes Modell will, waehlt es dort — hier waere eine
  // zweite Modellauswahl nur eine zweite Stelle, an der sie auseinanderlaufen.
  modell = 'gpt-image-2', zielKlasse = null, szenenName = null,
}: {
  /** Die Szene — Vorlage für jeden Schritt. Braucht Charakter und Location. */
  scene: Scene
  referenzen: Referenz[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
  modell?: ModellId
  zielKlasse?: KlassenId | null
  szenenName?: string | null
}) {
  const { anlegen } = useImageJobs(false)
  const { outfits } = useOutfits()
  const [optionen, setOptionen] = useState<KettenOptionen>(KETTE_VORGABE)
  const [pickerOffen, setPickerOffen] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState(0)

  /**
   * DIE SPERRE LIEGT IM REF, NICHT IM STATE. `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern — zwei schnelle Klicks kämen beide durch und reihten zehn
   * bezahlte Erzeugungen ein statt fünf.
   */
  const laeuftRef = useRef(false)

  const kette = useMemo(() => baueShooting(scene, optionen), [scene, optionen])

  // OHNE ORT KEIN SHOOTING, OHNE MENSCH AUCH NICHT. Ein Shooting ohne Location
  // wäre nur eine Bilderreihe, und ohne Charakter stünde niemand darin.
  const fehlt: string[] = []
  if (!scene.location) fehlt.push('eine Location')
  if (!scene.character) fehlt.push('einen Charakter')

  async function handleShooting() {
    if (laeuftRef.current || fehlt.length > 0) return
    laeuftRef.current = true
    setLaeuft(true)
    setFortschritt(0)

    // Eine Kennung für das ganze Shooting. Der Lichttisch zeigt sie noch nicht
    // gruppiert — ohne sie wäre das später gar nicht mehr möglich.
    const reiheId = crypto.randomUUID()
    const zuordnung = groesseFuerFormat(aspectRatio)
    let eingereiht = 0

    try {
      for (const schritt of kette) {
        /*
          DIE REFERENZEN WECHSELN MIT DEM OUTFIT. Wer den Wechsel nur in den
          Prompttext schreibt und weiter das erste Outfit anhängt, bekommt
          zwei gegenläufige Anweisungen: „das Outfit wechselt hier" im Text und
          das alte Kleidungsstück als Bild. Das Bild gewinnt.
        */
        const refs: Referenz[] = referenzen
          .filter(r => r.rolle !== 'outfit')
          .concat(
            schritt.outfit?.cover_image_url
              ? [{ url: schritt.outfit.cover_image_url, rolle: 'outfit' as ReferenzRolle }]
              : [],
          )
        const rollen = refs.map(r => r.rolle)

        const job = await anlegen({
          prompt: promptFuerAuftrag(schritt.prompt, aspectRatio, rollen),
          model: modell,
          size: zuordnung.size,
          // EIN Format für das ganze Shooting. Was sich ändert, ist der
          // Bildausschnitt, nicht das Seitenverhältnis.
          aspect_ratio: aspectRatio,
          variants: 1,
          ziel_klasse: zielKlasse,
          reference_urls: refs.map(r => r.url),
          reference_roles: rollen,
          scene_meta: {
            ...sceneMeta,
            name: `${szenenName ?? scene.location?.name ?? 'Shooting'} — ${schritt.label}`,
            herkunft: 'shooting-kette',
            shot_type: schritt.shot_type,
            spot: schritt.key,
            reihe_id: reiheId,
            reihe_nr: schritt.nr,
            reihe_gesamt: schritt.gesamt,
          },
        })

        // Beim ersten Fehlschlag anhalten. `anlegen` meldet den Grund selbst;
        // vier weitere gleichlautende Meldungen wären nur Lärm — und das
        // Shooting ist ohnehin unvollständig.
        if (!job) break
        eingereiht++
        setFortschritt(eingereiht)
      }
    } catch (e) {
      // OHNE DIESES `catch` WÄRE DER FEHLER UNSICHTBAR — und die schon
      // bezahlten Bilder mit ihm. `anlegen` fängt Datenbankfehler selbst ab,
      // aber `supabase.auth.getUser()` darin wirft bei abgerissener
      // Verbindung; die Ausnahme würde zu einer unbehandelten
      // Promise-Ablehnung, und der Knopf sähe danach normal aus.
      toast.error(`Abgebrochen nach ${eingereiht} von ${kette.length}: ${(e as Error).message}`)
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
    }

    if (eingereiht > 0) {
      toast.success(
        eingereiht === kette.length
          ? `Shooting eingereiht — ${eingereiht} Bilder in der Warteschlange.`
          : `Nur ${eingereiht} von ${kette.length} eingereiht.`,
      )
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Camera className="h-4 w-4" />
        Shooting an dieser Location
      </div>

      <p className="text-[13px] text-muted-foreground leading-relaxed">
        Vier Plätze am selben Ort — weit, mit Tiefe, an einer Fläche, im
        Gegenlicht. Gleiche Person, gleiches Licht, gleicher Tag; nur Standort,
        Bildausschnitt und Haltung ändern sich.
      </p>

      <label className="flex items-start gap-2 text-[13px] cursor-pointer">
        <Checkbox
          className="mt-0.5"
          checked={optionen.mitUebergang}
          onCheckedChange={v => setOptionen(o => ({ ...o, mitUebergang: v === true }))}
        />
        <span>
          <span className="font-medium">Weg dazwischen</span>
          <span className="text-muted-foreground">
            {' '}— ein Bild unterwegs zum nächsten Platz, unposiert. Macht aus
            vier Bildern eine Geschichte.
          </span>
        </span>
      </label>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="sm" className="h-8 text-[13px]"
            onClick={() => setPickerOffen(true)}
          >
            <Shirt className="mr-1.5 h-3.5 w-3.5" />
            {optionen.zweitesOutfit ? optionen.zweitesOutfit.name : 'Outfitwechsel …'}
          </Button>
          {optionen.zweitesOutfit && (
            <Button
              variant="ghost" size="icon" className="h-8 w-8"
              onClick={() => setOptionen(o => ({ ...o, zweitesOutfit: null }))}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Outfitwechsel entfernen</span>
            </Button>
          )}
        </div>
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed">
          {optionen.zweitesOutfit
            ? 'Ab dem Platz nach dem Übergang wird umgezogen — später am selben Tag.'
            : 'Ohne Angabe bleibt es beim Outfit der Szene.'}
        </p>
      </div>

      {fehlt.length > 0 ? (
        <p className="text-[13px] text-amber-400/90 leading-relaxed">
          Dafür fehlt noch {fehlt.join(' und ')}. Ein Shooting braucht einen
          Ort und jemanden, der dort steht.
        </p>
      ) : (
        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-500"
          onClick={handleShooting}
          disabled={laeuft}
        >
          {laeuft
            ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                {fortschritt}/{kette.length} eingereiht …</>
            : <><Camera className="mr-1.5 h-3.5 w-3.5" />Shooting erzeugen</>}
        </Button>
      )}

      <p className="text-[12px] text-muted-foreground/60">
        {kettenAnsage(kette.length)} Jedes einzeln — ein misslungenes lässt sich
        wiederholen, ohne die anderen noch einmal zu bezahlen.
      </p>

      {pickerOffen && (
        <AssetPickerDialog
          isOpen
          onClose={() => setPickerOffen(false)}
          rolle="outfit"
          assets={outfits}
          onFertig={(asset) => {
            setOptionen(o => ({ ...o, zweitesOutfit: asset as unknown as Outfit }))
            setPickerOffen(false)
          }}
        />
      )}
    </div>
  )
}
