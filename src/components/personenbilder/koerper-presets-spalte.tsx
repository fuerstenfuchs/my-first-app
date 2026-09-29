'use client'

import { useState } from 'react'
import { Vorschaubild } from '@/components/vorschaubild'
import type { KoerperAuswahl } from '@/lib/referenzkette'
import { gesetzteRegionen } from '@/lib/koerper-regionen'
import { bereinigeMerkmale, bereinigeName, hatInhalt, type NutzerPreset } from '@/lib/koerper-nutzer-presets'
import { koerperBildName } from '@/components/personenbilder/koerperkarte'

/**
 * Eigene Körperform-Presets (PROJ-92) — links neben der Körperkarte.
 *
 * Mark am 29.09.2026: „Die Möglichkeit, Presets zu erstellen und auch zu
 * benennen. Dass ich zum Beispiel sage, ich nenne ein Preset Model und setze
 * dann die verschiedenen Körperkriterien und kann das abspeichern. Und wenn
 * ich draufklicke, ist alles schon so wie im Preset vorgespeichert."
 *
 * EIN KLICK ERSETZT DIE GANZE AUSWAHL (nicht: mischt sich ein). Ein Preset ist
 * ein Stand, kein Zusatz — sonst hinge an „Model" noch, was vorher zufällig
 * eingestellt war, und es sähe je nach Vorgeschichte anders aus. Manuell weiter
 * einstellen geht danach wie immer.
 */
export function KoerperPresetsSpalte({
  presets, laedt, fehler, auswahl, koerperBild, gewaehlt, geaendert,
  onWaehlen, onAnlegen, onUeberschreiben, onUmbenennen, onLoeschen, onLeeren,
}: {
  presets: NutzerPreset[]
  laedt: boolean
  fehler: string | null
  auswahl: KoerperAuswahl
  koerperBild: string | null
  gewaehlt: string | null
  /** Weicht die aktuelle Einstellung vom gewählten Preset ab? */
  geaendert: boolean
  onWaehlen: (p: NutzerPreset) => void
  onAnlegen: (name: string) => Promise<boolean>
  onUeberschreiben: (id: string) => Promise<boolean>
  onUmbenennen: (id: string, name: string) => Promise<boolean>
  onLoeschen: (id: string) => Promise<boolean>
  onLeeren: () => void
}) {
  const [name, setName] = useState('')
  const [beschaeftigt, setBeschaeftigt] = useState(false)
  const [umbenennenId, setUmbenennenId] = useState<string | null>(null)
  const [neuerName, setNeuerName] = useState('')
  const kannSpeichern = hatInhalt(auswahl, koerperBild) && bereinigeName(name).length > 0 && !beschaeftigt

  async function speichern() {
    if (!kannSpeichern) return
    setBeschaeftigt(true)
    try {
      if (await onAnlegen(name)) setName('')
    } finally {
      setBeschaeftigt(false)
    }
  }

  async function umbenennenFertig(id: string) {
    setBeschaeftigt(true)
    try {
      if (await onUmbenennen(id, neuerName)) setUmbenennenId(null)
    } finally {
      setBeschaeftigt(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="pb-titelzeile" style={{ marginBottom: 0 }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700 }}>Meine Presets</h2>
        <span className="pb-zahl ml-auto">{presets.length}</span>
      </div>
      <div className="sb-dbl" aria-hidden="true" />

      {/* Neu anlegen aus der aktuellen Einstellung */}
      <div className="sb-mod flex flex-col gap-2.5 p-3.5">
        <label htmlFor="pb-preset-name" className="text-[15px] font-semibold">Aktuelle Einstellung speichern</label>
        <input
          id="pb-preset-name" className="pb-suche" value={name} maxLength={60}
          placeholder="Name, z. B. Model"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void speichern() }}
        />
        <button type="button" className="sb-taste" disabled={!kannSpeichern} onClick={() => void speichern()}>
          Speichern
        </button>
        {!hatInhalt(auswahl, koerperBild) && (
          <p className="pb-hinweis">Erst rechts oder auf der Karte etwas einstellen.</p>
        )}
      </div>

      {fehler && (
        <p className="pb-fehler" role="alert">
          Die Presets lassen sich nicht laden: {fehler}
        </p>
      )}

      {laedt ? (
        <p className="pb-hinweis">Lädt …</p>
      ) : presets.length === 0 && !fehler ? (
        <p className="pb-hinweis">Noch keine eigenen Presets.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {presets.map(p => {
            const an = gewaehlt === p.id
            const regionen = gesetzteRegionen(p.merkmale)
            return (
              <div key={p.id} className="flex flex-col gap-2">
                <button
                  type="button" className="pb-kachel"
                  data-an={an ? 'ja' : undefined}
                  onClick={() => onWaehlen(p)}
                >
                  <span className="pb-name">{p.name}</span>
                  <span className="pb-klein">
                    {regionen.length === 0
                      ? 'nur Körperbild'
                      : regionen.length === 1 ? '1 Region' : `${regionen.length} Regionen`}
                    {p.koerperBild ? ` · ${koerperBildName(p.koerperBild)}` : ''}
                  </span>
                  {an && geaendert && <span className="pb-status">geändert</span>}
                  {p.koerperBild && (
                    <span className="pb-bild dunkel" style={{ maxWidth: 96, aspectRatio: '1 / 1' }}>
                      <Vorschaubild src={p.koerperBild} alt="" />
                    </span>
                  )}
                </button>

                {an && (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="sb-taste klein" disabled={beschaeftigt}
                      title="Mit der aktuellen Einstellung überschreiben"
                      onClick={() => { setBeschaeftigt(true); void onUeberschreiben(p.id).finally(() => setBeschaeftigt(false)) }}>
                      Überschreiben
                    </button>
                    <button type="button" className="sb-taste klein" disabled={beschaeftigt}
                      onClick={() => { setUmbenennenId(p.id); setNeuerName(p.name) }}>
                      Umbenennen
                    </button>
                    <button type="button" className="sb-taste klein" disabled={beschaeftigt}
                      onClick={() => {
                        if (window.confirm(`Preset „${p.name}" löschen?`)) {
                          setBeschaeftigt(true)
                          void onLoeschen(p.id).finally(() => setBeschaeftigt(false))
                        }
                      }}>
                      Löschen
                    </button>
                  </div>
                )}

                {umbenennenId === p.id && (
                  <div className="flex flex-col gap-2">
                    <input
                      className="pb-suche" value={neuerName} maxLength={60} autoFocus
                      aria-label="Neuer Name"
                      onChange={e => setNeuerName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') void umbenennenFertig(p.id)
                        if (e.key === 'Escape') setUmbenennenId(null)
                      }}
                    />
                    <div className="flex gap-2">
                      <button type="button" className="sb-taste klein" disabled={beschaeftigt || !bereinigeName(neuerName)}
                        onClick={() => void umbenennenFertig(p.id)}>Übernehmen</button>
                      <button type="button" className="sb-taste klein" onClick={() => setUmbenennenId(null)}>Abbrechen</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <button type="button" className="sb-taste" onClick={onLeeren}
        disabled={!hatInhalt(bereinigeMerkmale(auswahl), koerperBild)}>
        Alles zurücksetzen
      </button>
    </div>
  )
}
