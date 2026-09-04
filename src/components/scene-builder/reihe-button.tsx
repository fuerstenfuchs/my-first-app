'use client'

import { useMemo, useRef, useState } from 'react'
import { Loader2, Film, Info } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useImageJobs } from '@/hooks/use-image-jobs'
import {
  groesseFuerFormat, promptFuerAuftrag,
  type ModellId, type KlassenId, type Referenz,
} from '@/lib/image-generation'
import { SHOT_TYPES, type AspectRatioKey, type ShotTypeKey } from '@/lib/scene-builder-options'
import {
  REIHEN_ORDNUNG, REIHE_VORBELEGUNG, baueReihe, reiheMeta, reihenAnsage,
} from '@/lib/einstellungsreihe'
import type { Scene } from '@/lib/szene-prompt'

interface ReiheButtonProps {
  /** Die fertige Szene — Vorlage für jede Einstellung. */
  scene: Scene
  /** Der Prompt der Szene, wie er rechts steht. Nur zur Sperre des Knopfes. */
  prompt: string
  referenzen: Referenz[]
  aspectRatio: AspectRatioKey | null
  sceneMeta: Record<string, unknown>
  szenenName?: string | null
  /** Modell und Größenklasse werden oben EINMAL gewählt und hier mitbenutzt. */
  modell: ModellId
  zielKlasse: KlassenId | null
}

/**
 * „Reihe erzeugen" (PROJ-44) — aus einer fertigen Szene mehrere Einstellungen.
 *
 * N AUFTRÄGE, NICHT EIN AUFTRAG MIT N DURCHLÄUFEN. `anlegen()` nimmt EINEN
 * Prompt und erzeugt ihn `variants`-mal; jede Einstellung braucht aber einen
 * anderen Prompt, weil die Einstellungsgröße als Textbaustein darin steckt.
 * Sieben Durchläufe eines Auftrags gäben siebenmal dieselbe Einstellung.
 *
 * Der Prompt-Bau selbst steht in `einstellungsreihe.ts` und ist dort geprüft.
 * Hier steht nur, was ohne Anmeldung nicht prüfbar wäre: einreihen, sperren,
 * melden.
 */
export function ReiheButton({
  scene, prompt, referenzen, aspectRatio, sceneMeta, szenenName = null,
  modell, zielKlasse,
}: ReiheButtonProps) {
  const { anlegen } = useImageJobs(false)
  const [gewaehlt, setGewaehlt] = useState<ShotTypeKey[]>(REIHE_VORBELEGUNG)
  const [laeuft, setLaeuft] = useState(false)
  const [fortschritt, setFortschritt] = useState(0)

  /**
   * DIE SPERRE LIEGT IM REF, NICHT IM STATE. `setLaeuft(true)` wirkt erst beim
   * nächsten Rendern — zwei schnelle Klicks kämen beide durch die Prüfung und
   * reihten die Reihe doppelt ein. Bei bis zu zehn bezahlten Erzeugungen ist
   * das Fenster größer als sonst, und genau dieser Fehler steht in
   * `features/OFFEN.md` als offener Befund.
   */
  const laeuftRef = useRef(false)

  const reihe = useMemo(() => baueReihe(scene, gewaehlt), [scene, gewaehlt])
  const anzahl = reihe.length
  const gesperrt = !prompt || anzahl === 0 || laeuft

  /**
   * Steckt die Einstellung, die in der Szene selbst eingestellt ist, auch in
   * der Reihe? Dann liefern der Auftragsknopf oben und die Reihe zusammen
   * ZWEIMAL denselben Prompt — zwei bezahlte Erzeugungen desselben Bildes,
   * ohne dass es irgendwo stünde. Geprüft wird gegen `reihe` und nicht gegen
   * `gewaehlt`, weil nur `reihe` das ist, was wirklich eingereiht wird.
   */
  const aktuelleInReihe = !!scene.shot_type && reihe.some(e => e.shot_type === scene.shot_type)

  function umschalten(key: ShotTypeKey) {
    setGewaehlt(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
  }

  async function handleReihe() {
    if (laeuftRef.current) return
    if (!prompt || anzahl === 0) return

    laeuftRef.current = true
    setLaeuft(true)
    setFortschritt(0)

    // Eine Kennung für die ganze Reihe. Der Lichttisch zeigt sie noch nicht
    // gruppiert — ohne sie wäre das später aber gar nicht mehr möglich.
    const reiheId = crypto.randomUUID()

    const zuordnung = groesseFuerFormat(aspectRatio)
    const rollen = referenzen.map(r => r.rolle)
    const urls = referenzen.map(r => r.url)

    let eingereiht = 0
    /** Was WIRKLICH durchkam — die Grundlage fürs Abwählen weiter unten. */
    const erledigt: ShotTypeKey[] = []
    let abgebrochen = false

    try {
      for (const einstellung of reihe) {
        const job = await anlegen({
          prompt:          promptFuerAuftrag(einstellung.prompt, aspectRatio, rollen),
          model:           modell,
          size:            zuordnung.size,
          // EIN Format für die ganze Reihe. Was sich ändert, ist der
          // Bildausschnitt, nicht das Seitenverhältnis.
          aspect_ratio:    aspectRatio,
          // IMMER genau ein Bild je Einstellung. Die Durchläufe-Auswahl über
          // diesem Kasten gilt hier NICHT — das steht auch als Satz im Kasten,
          // weil die Auswahl sonst so aussieht, als gälte sie für beide Knöpfe.
          variants:        1,
          ziel_klasse:     zielKlasse,
          reference_urls:  urls,
          reference_roles: rollen,
          scene_meta:      reiheMeta({ ...sceneMeta, name: szenenName }, reiheId, einstellung),
        })

        // Beim ersten Fehlschlag anhalten. `anlegen` meldet den Grund bereits
        // selbst; neun weitere gleichlautende Meldungen hinterher wären nur
        // Lärm — und die Reihe ist ohnehin unvollständig.
        if (!job) break
        eingereiht++
        erledigt.push(einstellung.shot_type)
        setFortschritt(eingereiht)
      }
    } catch (e) {
      /**
       * OHNE DIESES `catch` WÄRE DER FEHLER UNSICHTBAR — und die schon
       * bezahlten Bilder unsichtbar mit ihm.
       *
       * `anlegen` fängt Datenbankfehler selbst ab, aber `supabase.auth
       * .getUser()` darin wirft bei abgerissener Verbindung. `onClick` nimmt
       * diese async-Funktion direkt entgegen; die Ausnahme würde also zu einer
       * unbehandelten Promise-Ablehnung: kein Toast, kein Fehlertext, der
       * Knopf sieht danach normal aus. Der naheliegende nächste Schritt wäre
       * ein zweiter Klick — auf Aufträge, die bereits laufen und bezahlt sind.
       * Deshalb nennt die Meldung die ZAHL: nur so weiß Mark, was schon läuft.
       */
      abgebrochen = true
      console.error('Einstellungsreihe abgebrochen', e)
      toast.error(
        eingereiht === 0
          ? 'Nichts eingereiht — die Verbindung ist abgerissen'
          : `Abgebrochen nach ${eingereiht} von ${anzahl} Einstellungen`,
        {
          description: eingereiht === 0
            ? 'Es wurde kein Bild in Auftrag gegeben. Nochmal versuchen, sobald die Verbindung wieder steht.'
            : `Diese ${eingereiht} sind bezahlt und stehen in der Warteschlange. Der Knopf bietet gleich nur noch die übrigen ${anzahl - eingereiht} an.`,
          ...(eingereiht > 0 && {
            action: { label: 'Warteschlange', onClick: () => { window.location.href = '/queue' } },
          }),
        },
      )
    } finally {
      laeuftRef.current = false
      setLaeuft(false)
      setFortschritt(0)
    }

    /**
     * NACH EINEM TEILABBRUCH DIE ERLEDIGTEN ABWÄHLEN.
     *
     * Vorher blieben nach „Nur 3 von 5" alle fünf angehakt. Der einzige
     * angebotene Weg — nochmal klicken — reihte alle fünf erneut ein, drei
     * davon ein zweites Mal bezahlt; und von außen ist nicht erkennbar, welche
     * drei durchkamen. Abgewählt bietet der Knopf danach genau die übrigen an,
     * und die Zahl darin stimmt.
     *
     * NUR IM TEILABBRUCH, nicht beim vollen Erfolg. Eine vollständige Reihe zu
     * wiederholen ist ein gewollter Vorgang: Mark ändert oben Licht, Objektiv
     * oder Referenz und will dieselben fünf Einstellungen noch einmal. Dort
     * wäre ein leerer Kasten nach jedem Lauf reine Klickarbeit — und die
     * Wiederholung kostet auch nichts ungewollt, weil sie der Auftrag ist. Beim
     * Teilabbruch ist es umgekehrt: dort ist das Wiederholen der Auswahl genau
     * das, was ungewollt doppelt zahlt.
     */
    if (eingereiht > 0 && eingereiht < anzahl) {
      setGewaehlt(prev => prev.filter(k => !erledigt.includes(k)))
    }

    // Der Fehlerfall hat seine Meldung schon — mit Zahl. Ein zweiter Toast
    // hinterher wäre nur Lärm.
    if (abgebrochen) return

    // BLEIBT ERREICHBAR: Gibt `anlegen` gleich beim ersten Auftrag regulär
    // `null` zurück (statt zu werfen), gibt es hier nichts zu melden — den
    // Grund hat `anlegen` selbst schon gesagt.
    if (eingereiht === 0) return

    toast.success(
      eingereiht === anzahl
        ? `${eingereiht} Einstellungen eingereiht`
        : `Nur ${eingereiht} von ${anzahl} Einstellungen eingereiht`,
      {
        description: eingereiht === anzahl
          ? 'Gleiche Szene, gleiches Licht — nur der Bildausschnitt wechselt.'
          : `Die ${eingereiht} sind bezahlt. Der Knopf bietet jetzt nur noch die übrigen ${anzahl - eingereiht} an — ein zweiter Klick reiht also nichts doppelt ein.`,
        action: { label: 'Warteschlange', onClick: () => { window.location.href = '/queue' } },
      },
    )
  }

  return (
    <div className="space-y-2.5 border border-[var(--sb-or)] bg-[var(--sb-or-l)] p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-bold uppercase tracking-[0.19em] text-[var(--sb-or-t)]">Einstellungsreihe</span>
        <button
          type="button"
          onClick={() => setGewaehlt(REIHE_VORBELEGUNG)}
          /*
            WÄHREND DES LAUFS GESPERRT, wie die Größen-Knöpfe daneben. Ein Klick
            mitten im Lauf setzt `gewaehlt` zurück, damit ändert sich `anzahl` —
            und im Knopf stünde „Einstellung 3 von 5", während neun Aufträge
            unterwegs sind. Die Schleife selbst läuft auf der bereits gebauten
            `reihe` weiter; falsch wäre also nur die Anzeige. Genau die muss bei
            bezahlten Erzeugungen stimmen.
          */
          disabled={laeuft}
          className="text-[13px] text-[var(--sb-or-t)] underline underline-offset-2 hover:text-[var(--sb-or)] disabled:opacity-40"
        >
          Vorschlag
        </button>
      </div>

      {/* Reihenfolge wie im Schnitt: weit → nah. Nicht die Klickreihenfolge. */}
      <div className="flex flex-wrap gap-1.5">
        {REIHEN_ORDNUNG.map(key => {
          const opt = SHOT_TYPES.find(s => s.key === key)!
          const an = gewaehlt.includes(key)
          // Die Einstellung, die in der Szene selbst steht — genau diese
          // erzeugt der Auftragsknopf oben.
          const istAktuelle = key === scene.shot_type
          return (
            <button
              key={key}
              type="button"
              aria-pressed={an}
              onClick={() => umschalten(key)}
              disabled={laeuft}
              title={istAktuelle ? 'Aktuelle Einstellung der Szene' : undefined}
              className={cn(
                'flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[13px] transition-colors disabled:opacity-40',
                an
                  ? 'border-[var(--sb-or)] bg-[var(--sb-or)] font-bold text-white'
                  : 'border-[var(--sb-rule)] bg-[var(--sb-card)] text-[var(--sb-ink2)] hover:border-[var(--sb-ink3)] hover:text-[var(--sb-ink)]',
                istAktuelle && 'ring-2 ring-inset ring-emerald-700',
              )}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>

      {/*
        DIE ZAHL STEHT VOR DEM KLICK DA. Ein Knopf, der einen Schritt nennt und
        mehrere bezahlte Erzeugungen startet, steht in diesem Projekt schon als
        offener Befund.
      */}
      <Button
        onClick={handleReihe}
        disabled={gesperrt}
        className="h-10 w-full text-sm font-bold bg-[var(--sb-or)] text-white hover:bg-[var(--sb-or-t)] disabled:opacity-40"
      >
        {laeuft
          ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Einstellung {Math.min(fortschritt + 1, anzahl)} von {anzahl}…</>
          : <><Film className="mr-1.5 h-4 w-4" />Reihe erzeugen — {reihenAnsage(anzahl)}</>}
      </Button>

      <p className="flex items-start gap-1.5 text-[13px] leading-snug text-[#5c3c1c]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          {anzahl === 0
            ? 'Mindestens eine Einstellungsgröße wählen.'
            : <>Ein eigener Auftrag je Einstellung — jeder einzeln wiederholbar.
                Charakter, Outfit, Location, Licht, Objektiv und Format bleiben gleich.</>}
        </span>
      </p>

      {/*
        DIE DURCHLÄUFE-AUSWAHL SIEHT AUS, ALS GÄLTE SIE AUCH HIER. Sie steht in
        derselben Karte, ein paar Zeilen höher („1× Bild … 4× Bild"), dieser
        Kasten sitzt darunter. Wer „3× Bild" einstellt und die Reihe startet,
        erwartet 15 Bilder und bekommt 5. Ein Bild je Einstellung ist richtig —
        also wird nicht das Verhalten geändert, sondern gesagt, was gilt.
      */}
      <p className="text-[13px] leading-snug text-[#6d5334]">
        Die Durchläufe-Auswahl oben gilt nur für den Auftragsknopf. Die Reihe
        erzeugt immer genau ein Bild je Einstellung.
      </p>

      {/*
        Die doppelte Erzeugung wird sichtbar gemacht, nicht verhindert: beide
        Wege zu nutzen ist legitim (der Auftragsknopf kann mehrere Durchläufe
        desselben Ausschnitts). Nur soll niemand versehentlich zweimal für
        dasselbe Bild zahlen.
      */}
      {aktuelleInReihe && (
        <p className="text-[13px] leading-snug text-emerald-800">
          Grün umrandet ist die Einstellung der Szene — sie steckt auch in dieser
          Reihe. Der Auftragsknopf oben erzeugt dann dasselbe Bild ein zweites Mal.
        </p>
      )}
    </div>
  )
}
