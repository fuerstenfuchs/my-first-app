'use client'

import { Vorschaubild } from '@/components/vorschaubild'
import type { KoerperAuswahl } from '@/lib/referenzkette'
import {
  KARTE_BILD, MASSLINIEN, extremeVon, feld, kartenNummer, punktLage, reiheFuer, stufenText,
  type KartenModus, type Schluessel,
} from '@/lib/koerper-regionen'
import { feldFuer } from '@/lib/koerper-felder'
import type { Geschlecht } from '@/lib/person-merkmale'
import { KOERPER_PRESETS } from '@/lib/koerper-presets'

/**
 * Die Körperkarte (PROJ-92) — Richtung B aus dem Entwurf: Die Figur ist die
 * Bedienung. Zwölf nummerierte Punkte auf der Blender-Grundfigur, rechts die
 * Stufen der gewählten Region samt der beiden Blender-Extreme.
 *
 * DIE PUNKTE SIND ECHTE KNÖPFE in fester Größe (44 px), nicht Teil einer
 * Grafik: In einer skalierten Grafik schrumpften die Ziffern mit der
 * Kartenbreite unter 13 px (Critic, 29.09.2026).
 */

export function Koerperkarte({
  auswahl, aktiv, onAktiv, modus = 'form', geschlecht = null,
}: {
  modus?: KartenModus
  geschlecht?: Geschlecht | null
  auswahl: KoerperAuswahl
  aktiv: Schluessel
  onAktiv: (k: Schluessel) => void
}) {
  return (
    <div className="pb-buehne">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={KARTE_BILD} alt="Grundfigur aus Blender, von vorn" />
      {modus === 'form' && MASSLINIEN.map((l, i) => (
        <span
          key={i} className="pb-masslinie" aria-hidden="true"
          style={{ left: `${l.x * 100}%`, top: `${l.von * 100}%`, height: `${(l.bis - l.von) * 100}%` }}
        />
      ))}
      {reiheFuer(modus).map(k => {
        const p = punktLage(k)
        const gesetzt = auswahl[k] != null
        return (
          <button
            key={k} type="button" className="pb-punkt"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            data-an={aktiv === k ? 'ja' : undefined}
            data-gesetzt={gesetzt ? 'ja' : undefined}
            aria-label={`${feldFuer(feld(k), geschlecht).label}${gesetzt ? `: ${stufenTextFuer(k, auswahl[k], geschlecht)}` : ''}`}
            aria-pressed={aktiv === k}
            onClick={() => onAktiv(k)}
          >
            {kartenNummer(k)}
          </button>
        )
      })}
    </div>
  )
}

/** Die Liste der zwölf Regionen neben der Karte — dieselbe Wahl, ohne Zielen. */
export function Regionsliste({
  auswahl, aktiv, onAktiv, modus = 'form', geschlecht = null,
}: {
  modus?: KartenModus
  geschlecht?: Geschlecht | null
  auswahl: KoerperAuswahl
  aktiv: Schluessel
  onAktiv: (k: Schluessel) => void
}) {
  return (
    <div className="pb-liste">
      {reiheFuer(modus).map(k => (
        <button
          key={k} type="button" className="sb-taste"
          data-an={aktiv === k ? 'ja' : undefined}
          aria-pressed={aktiv === k}
          onClick={() => onAktiv(k)}
        >
          <span>{kartenNummer(k)} · {feldFuer(feld(k), geschlecht).label}</span>
          <small>{stufenTextFuer(k, auswahl[k], geschlecht) ?? 'aus Bild'}</small>
        </button>
      ))}
    </div>
  )
}

/**
 * Die Stufen der gewählten Region.
 *
 * Die beiden Blender-Bilder oben sind zugleich Wahl UND Referenz: Ein Klick
 * setzt die Stufe und nimmt das Bild als Körperbild mit (wie die Presets der
 * Referenzkette). Die Stufenknöpfe darunter setzen nur den Text.
 */
export function Stufenfeld({
  region, auswahl, koerperBild, onWert, onWertMitBild, geschlecht = null,
}: {
  geschlecht?: Geschlecht | null
  region: Schluessel
  auswahl: KoerperAuswahl
  koerperBild: string | null
  onWert: (k: Schluessel, wert: string | null) => void
  onWertMitBild: (k: Schluessel, wert: string, bildUrl: string) => void
}) {
  const f = feldFuer(feld(region), geschlecht)
  const gewaehlt = auswahl[region] ?? null
  // Die Oberweite-Bilder zeigen eine Büste; bei einem Mann würden sie sie mitliefern.
  const extremen = geschlecht === 'mann' && region === 'oberweite' ? [] : extremeVon(region)
  return (
    <div>
      <div className="pb-titelzeile">
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 700 }}>
          {kartenNummer(region)} · {f.label}
        </h2>
      </div>
      <div className="sb-dbl mb-4" aria-hidden="true" />

      {extremen.length > 0 && <div className="pb-paar mb-4">
        {extremen.map(e => (
          <button
            key={e.wert} type="button" className="pb-kachel"
            data-an={gewaehlt === e.wert && koerperBild === e.bildUrl ? 'ja' : undefined}
            aria-pressed={gewaehlt === e.wert && koerperBild === e.bildUrl}
            onClick={() => onWertMitBild(region, e.wert, e.bildUrl)}
          >
            <div className="pb-bild dunkel">
              <Vorschaubild src={e.bildUrl} alt="" />
            </div>
            <span className="pb-name">{e.text}</span>
          </button>
        ))}
      </div>}

      <div className="pb-stufen">
        {f.optionen.map(o => (
          <button
            key={o.wert} type="button" className="sb-taste"
            data-an={gewaehlt === o.wert ? 'ja' : undefined}
            aria-pressed={gewaehlt === o.wert}
            onClick={() => onWert(region, o.wert)}
          >
            {o.text}
          </button>
        ))}
        <button
          type="button" className="sb-taste"
          data-an={gewaehlt === null ? 'ja' : undefined}
          aria-pressed={gewaehlt === null}
          onClick={() => onWert(region, null)}
        >
          Aus Bild
        </button>
      </div>
    </div>
  )
}

/** Anzeigename einer Stufe in der Wortwahl zum Geschlecht. */
function stufenTextFuer(k: Schluessel, wert: string | undefined, geschlecht: Geschlecht | null): string | null {
  if (!wert) return null
  return feldFuer(feld(k), geschlecht).optionen.find(o => o.wert === wert)?.text ?? null
}

/** Wie das gewählte Körperbild heißt — sein Preset, sonst „eigenes Bild". */
export function koerperBildName(url: string | null): string | null {
  if (!url) return null
  return KOERPER_PRESETS.find(p => p.bildUrl === url)?.label ?? 'Eigenes Körperbild'
}
