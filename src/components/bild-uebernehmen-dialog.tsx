'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { ImageOff, Search, Loader2, Check } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  BAUSTEINE, baustein, passtZurSuche, kategorien, kategorieLabel,
  type BausteinSchluessel,
} from '@/lib/bausteine'
import { useBildUebernehmen, type Eintrag, type Variante } from '@/hooks/use-bild-uebernehmen'
import { cn } from '@/lib/utils'

/**
 * „Übernehmen nach …" — ein fertiges Bild in eine Bibliothek legen.
 *
 * Ersetzt sieben Handgriffe über drei Bildschirme: herunterladen, zur
 * Bibliothek wechseln, Eintrag suchen, Variante wählen, hochladen, beschriften.
 *
 * AUSWAHL ÜBER BILDER, NICHT ÜBER NAMEN. Dieselbe Lehre wie beim
 * Referenz-Auswahldialog: Mark kennt die Namen seiner Outfits nicht, er
 * erkennt sie am Bild. Ein Suchfeld ist die Abkürzung bei vielen Einträgen,
 * nicht die Voraussetzung, um überhaupt etwas zu sehen.
 */

interface Props {
  offen: boolean
  onClose: () => void
  /**
   * Adresse UND Speicherpfad des Bildes. Der Pfad wird als Notiz gespeichert,
   * weil die Adresse einen wechselnden Cache-Brecher trägt.
   */
  bild: { url: string; pfad: string } | null
  /** Wird nach erfolgreicher Übernahme gerufen. */
  onFertig?: () => void
}

export function BildUebernehmenDialog({ offen, onClose, bild, onFertig }: Props) {
  const { laeuft, eintraegeLaden, variantenLaden, uebernehmen } = useBildUebernehmen()

  const [art, setArt] = useState<BausteinSchluessel>('charaktere')
  const [eintraege, setEintraege] = useState<Eintrag[]>([])
  const [laedt, setLaedt] = useState(false)
  const [suche, setSuche] = useState('')
  /** Die angeklickte Kategorie — null heißt „alle". */
  const [kategorie, setKategorie] = useState<string | null>(null)
  const [gewaehlt, setGewaehlt] = useState<Eintrag | null>(null)
  const [varianten, setVarianten] = useState<Variante[]>([])
  const [variantId, setVariantId] = useState<string | null>(null)

  const b = baustein(art)

  // Beim Öffnen und bei jedem Wechsel der Art neu laden.
  useEffect(() => {
    if (!offen) return
    let abgebrochen = false
    setLaedt(true)
    setGewaehlt(null)
    setVarianten([])
    setVariantId(null)
    // Die Kategorien eines Bausteins gelten nicht beim nächsten. Bliebe „natur"
    // beim Wechsel zu den Posen stehen, wäre die Liste leer und niemand wüsste
    // warum.
    setKategorie(null)
    void eintraegeLaden(b).then(liste => {
      if (!abgebrochen) { setEintraege(liste); setLaedt(false) }
    })
    return () => { abgebrochen = true }
  }, [offen, art, b, eintraegeLaden])

  // Varianten erst holen, wenn ein Eintrag gewählt ist.
  useEffect(() => {
    if (!gewaehlt) return
    let abgebrochen = false
    void variantenLaden(b, gewaehlt.id).then(liste => {
      if (abgebrochen) return
      setVarianten(liste)
      // Hat der Eintrag nur eine Variante, ist die Wahl keine Frage. Gibt es
      // gar keine (Archetypen, Prompts), bleibt es null — dort hängt das Bild
      // direkt am Eintrag.
      setVariantId(liste[0]?.id ?? null)
    })
    return () => { abgebrochen = true }
  }, [gewaehlt, b, variantenLaden])

  // Erst die Wörter, dann die Kategorie — beides greift zusammen.
  const gesucht = useMemo(
    () => eintraege.filter(e => passtZurSuche(e, suche)),
    [eintraege, suche],
  )
  const gefiltert = useMemo(
    () => (kategorie ? gesucht.filter(e => e.category === kategorie) : gesucht),
    [gesucht, kategorie],
  )

  /**
   * Die Chips über der Liste.
   *
   * Die LISTE kommt aus allen Einträgen, die ANZAHL aus den gerade gesuchten.
   * Absichtlich so: Verschwände ein Chip beim Tippen, ließe sich eine gesetzte
   * Kategorie nicht mehr abwählen — und die Knöpfe würden unter dem Finger
   * wegspringen. Die Zahl darf null werden, der Knopf bleibt.
   */
  const chips = useMemo(() => {
    if (!b.suchFelder.kategorie) return []
    const alle = kategorien(eintraege)
    if (alle.length < 2) return []
    return alle.map(k => ({
      wert: k.wert,
      anzahl: gesucht.filter(e => e.category === k.wert).length,
    }))
  }, [b, eintraege, gesucht])

  const bestaetigen = useCallback(async () => {
    if (!bild || !gewaehlt) return
    // Ein Baustein MIT Varianten braucht eine gewählte; einer ohne nicht.
    if (b.varianten && !variantId) return
    const ok = await uebernehmen(bild.url, bild.pfad, {
      baustein: art,
      parentId: gewaehlt.id,
      parentName: gewaehlt.name,
      variantId,
    })
    if (ok) { onFertig?.(); onClose() }
  }, [bild, gewaehlt, variantId, art, b, uebernehmen, onFertig, onClose])

  const bereit = !!gewaehlt && (!b.varianten || !!variantId) && !laeuft

  return (
    <Dialog open={offen} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] max-w-2xl flex-col gap-3 overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle>Bild übernehmen</DialogTitle>
          <DialogDescription className="text-xs">
            Das Bild wird in den Speicher des Bausteins kopiert. Es bleibt dort,
            auch wenn Du den Auftrag später löschst. Das Titelbild bleibt unverändert.
          </DialogDescription>
        </DialogHeader>

        {/* Wohin — neun Ziele in drei Reihen, immer sichtbar. Reihe 1 und 2 sind
            die Bibliotheken und die Prompts, Reihe 3 die Archetypen. */}
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-3">
          {BAUSTEINE.map(eintrag => {
            const Icon = eintrag.icon
            const aktiv = eintrag.schluessel === art
            return (
              <button
                key={eintrag.schluessel}
                onClick={() => setArt(eintrag.schluessel)}
                aria-pressed={aktiv}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-md border px-2 py-2 text-[11px] transition',
                  aktiv
                    ? 'border-primary bg-primary/10 font-medium text-primary'
                    : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {eintrag.label}
              </button>
            )
          })}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={suche}
            onChange={e => setSuche(e.target.value)}
            placeholder={`${b.einzahl} suchen …`}
            className="h-8 pl-8 text-xs"
          />
        </div>

        {/*
          Kategorien als Chips — nur, wo es sie gibt und wo mehr als eine
          vorkommt. Ein einzelner Chip filtert nichts und kostet nur Platz.

          Mark am 03.09.2026 nachgemessen: Von 46 Locations sind 31 Stadien und
          zehn Natur. Wer eine Naturkulisse sucht, blättert bisher an allen 31
          Stadien vorbei. Die Zahl steht deshalb neben dem Namen — man soll
          sehen, was hinter einem Knopf steckt, BEVOR man ihn drückt.

          Der Dialog ist schmal: `flex-wrap` und eine eigene Rollfläche mit
          Höhenlimit, damit viele Kategorien ihn nicht auseinanderziehen.

          `shrink-0` ist hier NICHT schmückendes Beiwerk. Ohne das war die Zeile
          im Browser 5 Punkte hoch, obwohl ihr Inhalt 23 braucht — von den
          Chips blieb ein Streifen übrig (am 03.09.2026 nachgemessen). Ein
          Flex-Kind schrumpft nämlich unter seinen Inhalt, wenn das Geschwister
          daneben Platz will, und das Bildraster will immer Platz. `max-h-16`
          war unschuldig: Die Höhe scheiterte nicht an der Obergrenze, sondern
          am Zusammenquetschen.
        */}
        {chips.length > 0 && (
          <div className="flex max-h-16 shrink-0 flex-wrap gap-1 overflow-y-auto">
            {chips.map(k => {
              const aktiv = kategorie === k.wert
              return (
                <button
                  key={k.wert}
                  onClick={() => setKategorie(aktiv ? null : k.wert)}
                  aria-pressed={aktiv}
                  title={aktiv ? 'Filter aufheben' : `Nur ${kategorieLabel(k.wert)} zeigen`}
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[11px] transition',
                    aktiv
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {kategorieLabel(k.wert)}
                  <span className="ml-1 tabular-nums opacity-60">{k.anzahl}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Die Galerie */}
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border/50 p-2">
          {laedt ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="aspect-[3/4] animate-pulse rounded bg-muted/40" />
              ))}
            </div>
          ) : gefiltert.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {eintraege.length === 0
                ? `Noch keine ${b.label} angelegt.`
                : kategorie && suche.trim()
                  ? `Kein Treffer für „${suche}" in ${kategorieLabel(kategorie)}.`
                  : kategorie
                    ? `Nichts in ${kategorieLabel(kategorie)}.`
                    : `Kein Treffer für „${suche}".`}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {gefiltert.map(e => {
                const aktiv = gewaehlt?.id === e.id
                return (
                  <button
                    key={e.id}
                    onClick={() => setGewaehlt(e)}
                    aria-pressed={aktiv}
                    className={cn(
                      'group relative overflow-hidden rounded border text-left transition',
                      aktiv ? 'border-primary ring-1 ring-primary' : 'border-border/50 hover:border-border',
                    )}
                  >
                    <div className="aspect-[3/4] bg-muted/30">
                      {e.cover_image_url ? (
                        <img
                          src={e.cover_image_url} alt={e.name} loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <ImageOff className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    <span className="block truncate px-1.5 py-1 text-[10px] leading-tight">
                      {e.name}
                    </span>
                    {aktiv && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/*
          Die Variante als sichtbare Auswahl, nicht als Aufklappmenü.

          Mark am 02.09.2026: „Allerdings werden die dann immer nur unter einem
          Bild abgelegt, also bei den Charakteren ist es das erste, das mit Kopf
          betitelt ist." Genau das war der Grund — das Menü stand klein am
          unteren Rand, vorbelegt mit der ersten Variante, und wurde übersehen.
          Eine Vorbelegung ist bequem; unsichtbar darf sie nicht sein.
        */}
        {gewaehlt && b.varianten && varianten.length > 1 && (
          <div className="space-y-1">
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              In welche Variante?
            </span>
            <div className="flex flex-wrap gap-1">
              {varianten.map(v => (
                <button
                  key={v.id}
                  onClick={() => setVariantId(v.id)}
                  aria-pressed={variantId === v.id}
                  className={cn(
                    'rounded border px-2 py-1 text-[11px] transition',
                    variantId === v.id
                      ? 'border-primary bg-primary/10 font-medium text-primary'
                      : 'border-border/60 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  {v.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {gewaehlt && b.varianten && varianten.length === 0 && (
          <p className="text-xs text-destructive">
            „{gewaehlt.name}" hat noch keine Variante — dort lässt sich kein Bild ablegen.
          </p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={laeuft}>
            Abbrechen
          </Button>
          <Button size="sm" onClick={() => void bestaetigen()} disabled={!bereit}>
            {laeuft && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {gewaehlt
              ? `Nach „${gewaehlt.name}${
                  varianten.length > 1 && variantId
                    ? ` · ${varianten.find(v => v.id === variantId)?.name ?? ''}`
                    : ''
                }" übernehmen`
              : 'Übernehmen'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
