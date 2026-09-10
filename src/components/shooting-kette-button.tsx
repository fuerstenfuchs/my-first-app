'use client'

import { useMemo, useRef, useState } from 'react'
import { Camera, Loader2, Shirt, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useImageJobs } from '@/hooks/use-image-jobs'
import { useOutfits } from '@/hooks/use-outfits'
import { AssetPickerDialog } from '@/components/prompts/asset-picker-dialog'
import { AblageWaehler } from '@/components/ablage-waehler'
import { createClient } from '@/lib/supabase'
import { referenzenSichern, sicherungsMeldung } from '@/lib/referenzen-sichern'
import { cn } from '@/lib/utils'
import type { AblageZiel } from '@/lib/ablage-auftrag'
import {
  groesseFuerFormat, promptFuerAuftrag,
  ROLLEN_ANWEISUNG,
  type ModellId, type KlassenId, type Referenz, type ReferenzRolle,
} from '@/lib/image-generation'
import { baueShooting, kettenAnsage, KETTE_VORGABE, type KettenOptionen } from '@/lib/shooting-kette'
import {
  gruppenGroesse, gruppenAnsage, gruppenBlattZuordnung, GRUPPEN_VORRANG,
  AUFSTELLUNGEN, type Aufstellung,
} from '@/lib/gruppen-shooting'
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
  modell = 'gpt-image-2.5-sunburst', zielKlasse = null, szenenName = null,
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
  const [ablage, setAblage] = useState<AblageZiel | null>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState(0)

  /**
   * DIE SPERRE LIEGT IM REF, NICHT IM STATE. `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern — zwei schnelle Klicks kämen beide durch und reihten zehn
   * bezahlte Erzeugungen ein statt fünf.
   */
  const laeuftRef = useRef(false)

  /*
    IST DER „CHARAKTER" EINE GRUPPE?

    Die Zahl steht am Charakter, nicht im Knopf — eine Gruppe ist ein
    gewoehnlicher Eintrag mit dem Schlagwort `gruppe`, ihr Titelbild ist das
    Referenzblatt. Damit braucht dieser Weg keine eigene Auswahl: Wer die
    Gruppe als Charakter waehlt, bekommt die Gruppenkette.

    null heisst ein Mensch — dann bleibt alles wie zuvor.
  */
  const gruppe = gruppenGroesse(scene.character)

  const kette = useMemo(
    () => baueShooting(scene, { ...optionen, gruppe }),
    [scene, optionen, gruppe],
  )

  // OHNE ORT KEIN SHOOTING, OHNE MENSCH AUCH NICHT. Ein Shooting ohne Location
  // wäre nur eine Bilderreihe, und ohne Charakter stünde niemand darin.
  // Nominativ, nicht Akkusativ: „Dafuer fehlt noch EIN Charakter", nicht
  // „einen". Und bei zweien fehlEN sie. Im Browser aufgefallen, nicht im Code.
  const fehlt: string[] = []
  if (!scene.location) fehlt.push('eine Location')
  if (!scene.character) fehlt.push('ein Charakter')

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

    /*
      DEN ORDNER JETZT ANLEGEN, NICHT FRUEHER.

      `variantId: null` heisst „neuer Ordner". Waere er schon beim Oeffnen des
      Waehlers entstanden, bliebe bei jedem Blick auf den Knopf ein leerer
      Ordner am Charakter zurueck — auch wenn Mark es sich anders ueberlegt.
      Hier ist der Punkt, an dem feststeht, dass wirklich erzeugt wird.
    */
    let ziel = ablage
    if (ziel && !ziel.variantId) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('character_variants')
        .insert({
          character_id: ziel.parentId,
          user_id: user?.id,
          name: ziel.variantName,
          description: `Shooting an ${scene.location?.name ?? 'einem Ort'}`,
        })
        .select('id')
        .single()
      // Ohne Ordner wird trotzdem erzeugt — die Bilder liegen dann in der
      // Warteschlange. Das Shooting scheitern zu lassen, weil ein Ordner
      // nicht angelegt werden konnte, waere die teurere Reaktion.
      if (data?.id) ziel = { ...ziel, variantId: data.id as string }
      else { ziel = null; toast.error('Ordner konnte nicht angelegt werden — die Bilder bleiben in der Warteschlange.') }
    }

    /*
      EINMAL SICHERN, NICHT FUENFMAL (PROJ-89).

      Die fuenf Auftraege teilen sich dieselben Referenzbilder — nur das Outfit
      wechselt. Stand das Sichern in der Schleife, wurde dasselbe fremde Bild
      fuenfmal geholt und fuenfmal unter einer neuen Kennung abgelegt: zehn
      Dateien statt zwei, und der Knopf stand die ganze Zeit auf „0/5". Bei 500
      MB Speicher ist das nicht folgenlos.
    */
    const alleAdressen = [...new Set(
      kette.flatMap(schritt => referenzen
        .filter(r => r.rolle !== 'outfit')
        .map(r => r.url)
        .concat(schritt.outfit?.cover_image_url ? [schritt.outfit.cover_image_url] : [])),
    )]
    const sicherung = await referenzenSichern(alleAdressen)
    const gesichert = new Map(alleAdressen.map((alt, i) => [alt, sicherung.urls[i]!]))
    const meldung = sicherungsMeldung(sicherung)
    if (meldung) toast.info(meldung)

    try {
      for (const schritt of kette) {
        /*
          DIE REFERENZEN WECHSELN MIT DEM OUTFIT. Wer den Wechsel nur in den
          Prompttext schreibt und weiter das erste Outfit anhängt, bekommt
          zwei gegenläufige Anweisungen: „das Outfit wechselt hier" im Text und
          das alte Kleidungsstück als Bild. Das Bild gewinnt.
        */
        const refs: Referenz[] = gruppe !== null
          // BEI EINER GRUPPE TRAEGT DAS BLATT DIE KLEIDUNG. Ein zusaetzliches
          // Outfitbild waere EIN Kleidungsstueck fuer alle — und das Bild
          // gewinnt gegen jeden Text, der etwas anderes sagt.
          ? referenzen.filter(r => r.rolle !== 'outfit')
          : referenzen
              .filter(r => r.rolle !== 'outfit')
              .concat(
                schritt.outfit?.cover_image_url
                  ? [{ url: schritt.outfit.cover_image_url, rolle: 'outfit' as ReferenzRolle }]
                  : [],
              )
        const rollen = refs.map(r => r.rolle)

        /*
          DAS GRUPPENBLATT MUSS ALS BLATT BENANNT WERDEN.

          Ohne eigene Zuordnungszeilen schreibt der Promptbau fuer die
          Charakterrolle woertlich „take the face, hair, skin tone and body
          identity of THIS PERSON" — Einzahl, fuer ein Bild mit bis zu fuenf
          Menschen in zwei Reihen. Genau der generische Wortlaut, gegen den
          PROJ-78 gebaut wurde, nur eine Ebene tiefer.

          Und der uebliche Vorrangsatz muss eingeengt werden: Er gaebe dem Bild
          den Vorrang, wenn der Text „die Person" anders beschreibt — und der
          Text beschreibt sie hier absichtlich anders, naemlich kauernd und
          sitzend statt aufrecht in einer Reihe.
        */
        const zuordnungTexte = gruppe !== null
          ? rollen.map(r => r === 'character'
              ? gruppenBlattZuordnung(gruppe)
              : ROLLEN_ANWEISUNG[r])
          : undefined

        const job = await anlegen({
          prompt: promptFuerAuftrag(
            schritt.prompt, aspectRatio, rollen,
            zuordnungTexte, gruppe !== null ? GRUPPEN_VORRANG : undefined,
          ),
          model: modell,
          size: zuordnung.size,
          // EIN Format für das ganze Shooting. Was sich ändert, ist der
          // Bildausschnitt, nicht das Seitenverhältnis.
          aspect_ratio: aspectRatio,
          variants: 1,
          ziel_klasse: zielKlasse,
          reference_urls: refs.map(r => gesichert.get(r.url) ?? r.url),
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
            // Der Waechter liest das spaeter aus und legt die fertigen Bilder
            // dort ab (PROJ-76).
            ...(ziel ? { ablage: ziel } : {}),
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
        Gegenlicht.{' '}
        {gruppe !== null
          ? `${gruppenAnsage(gruppe)} Licht und Tag bleiben gleich.`
          : 'Gleiche Person, gleiches Licht, gleicher Tag; nur Standort, Bildausschnitt und Haltung ändern sich.'}
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

      {/*
        WER WO STEHT (PROJ-86).

        Mark: „Da sollte man die Reihenfolge auf jeden Fall aendern koennen.
        Optisch gesehen anhand der Bilder, die ist immer gleich von links nach
        rechts."
      */}
      {gruppe !== null && (
        <div className="space-y-1.5">
          <span className="text-[13px] font-medium">Aufstellung</span>
          <div className="flex flex-wrap gap-1.5">
            {AUFSTELLUNGEN.map(a => (
              <button
                key={a.id}
                onClick={() => setOptionen(o => ({ ...o, aufstellung: a.id }))}
                className={cn(
                  'rounded-full border px-3 py-1 text-[13px] transition',
                  optionen.aufstellung === a.id
                    ? 'border-emerald-500/60 bg-emerald-600/20 text-foreground'
                    : 'border-border/60 text-muted-foreground hover:text-foreground',
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-[13px] leading-snug text-muted-foreground">
            {AUFSTELLUNGEN.find(a => a.id === optionen.aufstellung)?.hinweis}
          </p>
        </div>
      )}

      <AblageWaehler
        charakter={scene.character}
        vorschlag={scene.location?.name ?? 'Shooting'}
        ziel={ablage}
        onZiel={setAblage}
      />

      {/*
        KEIN OUTFITWECHSEL BEI EINER GRUPPE. Die Kleidung steht im
        Referenzblatt, eine Garnitur je Person. Ein zweites Outfit ist EIN
        Kleidungsstueck — es zoege allen dasselbe an. Wer eine Gruppe umziehen
        will, braucht ein zweites Blatt.
      */}
      {gruppe === null && (
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
      )}

      {fehlt.length > 0 ? (
        <p className="text-[13px] text-amber-400/90 leading-relaxed">
          Dafür {fehlt.length > 1 ? 'fehlen' : 'fehlt'} noch{' '}
          {fehlt.join(' und ')}. Ein Shooting braucht einen Ort und jemanden,
          der dort steht.
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
