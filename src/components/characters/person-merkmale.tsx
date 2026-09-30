'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import {
  GESCHLECHTER, STELLEN, stelleDe,
  type Geschlecht, type Hautzeichen, type StelleId,
} from '@/lib/person-merkmale'

const KNOPF = 'inline-flex items-center gap-1.5 rounded-lg border border-[#948668] bg-background px-3 py-1.5 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50'
/** Auf der Papierseite (`--sb-ink3`, 5,1:1) und in den Dialogen (Fallback) lesbar. */
const HINWEIS = { color: 'var(--sb-ink3, hsl(var(--muted-foreground)))' } as const
const FELD = 'rounded-lg border border-[#948668] bg-background px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * Geschlecht und Hautzeichen der Person.
 *
 * Steht dort, wo auch der Körperbau gewählt wird — beides beeinflusst dieselben
 * Prompts. Die Hautzeichen sind für Stellen gedacht, die das Originalfoto nicht
 * zeigt (Tattoo unter der langen Hose): Sie gehen in jeden Prompt mit, und das
 * Bild zeigt sie, sobald die Kleidung die Stelle freigibt.
 */
export function PersonMerkmale({
  geschlecht, hautzeichen, onGeschlecht, onHautzeichen, gesperrt = false, fehler = false,
}: {
  /** Solange die Person lädt (oder das Lesen scheiterte) darf nichts geändert werden. */
  gesperrt?: boolean
  fehler?: boolean
  geschlecht: Geschlecht | null
  hautzeichen: Hautzeichen[]
  onGeschlecht: (g: Geschlecht | null) => void
  onHautzeichen: (z: Hautzeichen[]) => void
}) {
  const [stelle, setStelle] = useState<StelleId>('oberschenkel_l')
  const [text, setText] = useState('')

  function hinzu() {
    const t = text.trim()
    if (!t || gesperrt || hautzeichen.length >= 12) return
    onHautzeichen([...hautzeichen, { stelle, text: t }])
    setText('')
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={gesperrt && !fehler}>
      {fehler && <p role="alert" className="text-sm font-semibold" style={{ color: '#b3261e' }}>Die Merkmale konnten nicht gelesen werden — bitte neu laden. Bis dahin wird nichts geändert.</p>}
      <div>
        <p className="mb-1.5 text-sm font-semibold">
          Geschlecht <span className="font-normal" style={HINWEIS}>— bestimmt die Wortwahl bei Bauch und Brustkorb</span>
        </p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Geschlecht">
          {GESCHLECHTER.map(g => (
            <button key={g.wert} type="button" className={KNOPF} disabled={gesperrt}
              aria-pressed={geschlecht === g.wert}
              style={geschlecht === g.wert ? { borderColor: '#c2540a', boxShadow: 'inset 0 0 0 1px #c2540a' } : undefined}
              onClick={() => onGeschlecht(geschlecht === g.wert ? null : g.wert)}>
              {g.text}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold">
          Tattoos, Narben, Muttermale <span className="font-normal" style={HINWEIS}>— auch was das Originalfoto nicht zeigt</span>
        </p>
        {hautzeichen.length > 0 && (
          <ul className="mb-2 flex flex-col gap-1.5">
            {hautzeichen.map((z, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-[#948668] px-3 py-1.5 text-sm">
                <span className="min-w-0 flex-1"><b>{stelleDe(z.stelle)}:</b> {z.text}</span>
                <button type="button" disabled={gesperrt} className="rounded p-1 hover:bg-muted focus-visible:outline focus-visible:outline-2 disabled:opacity-50"
                  aria-label={`${stelleDe(z.stelle)} entfernen`}
                  onClick={() => onHautzeichen(hautzeichen.filter((_, j) => j !== i))}>
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <select className={FELD} value={stelle} onChange={e => setStelle(e.target.value as StelleId)} aria-label="Körperstelle">
            {STELLEN.map(s => <option key={s.id} value={s.id}>{s.de}</option>)}
          </select>
          <input className={`${FELD} min-w-[12rem] flex-1`} value={text} maxLength={200}
            placeholder="z. B. Drachen-Tattoo, schwarz, ca. 20 cm"
            aria-label="Beschreibung des Hautzeichens"
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); hinzu() } }} />
          <button type="button" className={KNOPF} onClick={hinzu} disabled={gesperrt || !text.trim() || hautzeichen.length >= 12}>
            <Plus className="h-4 w-4" /> Hinzufügen
          </button>
        </div>
        {hautzeichen.length >= 12 && <p className="mt-1.5 text-sm" style={HINWEIS}>Mehr als 12 Einträge sind nicht möglich.</p>}
      </div>
    </div>
  )
}
