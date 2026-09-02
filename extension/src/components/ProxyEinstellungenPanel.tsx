import { useEffect, useState } from 'react'
import {
  proxyLesen, proxySchreiben, proxyPruefen,
  PROXY_MODELLE, PROXY_VORGABE_URL,
  type ProxyEinstellungen,
} from '../lib/proxy'

/**
 * Der eigene Proxy — Einstellungen in der Erweiterung.
 *
 * WARUM DAS HIER EIN ZWEITES MAL STEHT: Die App legt ihre Einstellungen im
 * `localStorage` ihres Ursprungs ab. Eine Erweiterung kommt dort nicht heran —
 * sie hat ihren eigenen Speicher. Der Zugangsschlüssel muss deshalb hier noch
 * einmal eingetragen werden.
 *
 * Die Alternative wäre gewesen, ihn aus einem geöffneten App-Tab zu fischen.
 * Das hätte still versagt, sobald der Tab zu ist — und ein Werkzeug, das
 * manchmal Geld ausgibt und manchmal nicht, je nachdem welche Tabs offen sind,
 * wäre schlechter als eines, das einmal nach einem Schlüssel fragt.
 */

export function ProxyEinstellungenPanel({ onClose }: { onClose: () => void }) {
  const [e, setE] = useState<ProxyEinstellungen | null>(null)
  const [prueft, setPrueft] = useState(false)
  const [befund, setBefund] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => { void proxyLesen().then(setE) }, [])

  if (!e) return <div className="p-3 text-xs text-zinc-500">Lädt…</div>

  function aendern(teil: Partial<ProxyEinstellungen>) {
    const neu = { ...(e as ProxyEinstellungen), ...teil }
    setE(neu)
    setBefund(null)
    void proxySchreiben(neu)  // sofort sichern, kein extra Knopf
  }

  async function pruefen() {
    setPrueft(true)
    setBefund(null)
    try {
      const r = await proxyPruefen(e as ProxyEinstellungen)
      setBefund(r.ok
        ? { ok: true, text: `${r.anzahl} Modelle erreichbar` }
        : { ok: false, text: r.text })
    } finally {
      setPrueft(false)
    }
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">Eigener Proxy</h2>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 rounded hover:bg-zinc-800"
        >
          Zurück
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-zinc-500">
        Bildanalysen laufen dann über deine eigene CLIProxyAPI statt über die
        kostenpflichtigen Dienste. Gilt nur in diesem Browser auf diesem Rechner.
        Ist der Proxy aus, fällt die Erweiterung automatisch auf den bezahlten
        Dienst zurück.
      </p>

      <label className="block">
        <span className="text-[11px] text-zinc-400">Adresse</span>
        <input
          type="text"
          value={e.url}
          placeholder={PROXY_VORGABE_URL}
          onChange={ev => aendern({ url: ev.target.value })}
          className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-[11px] text-zinc-400">Zugangsschlüssel</span>
        <input
          type="password"
          value={e.token}
          placeholder="derselbe wie in worker/.env"
          onChange={ev => aendern({ token: ev.target.value })}
          className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
        />
      </label>

      <label className="block">
        <span className="text-[11px] text-zinc-400">Modell</span>
        <select
          value={e.modell}
          onChange={ev => aendern({ modell: ev.target.value })}
          className="mt-1 w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1.5 text-xs text-zinc-100 focus:border-violet-500 focus:outline-none"
        >
          {PROXY_MODELLE.map(m => (
            <option key={m.id} value={m.id}>{m.id} — {m.beschreibung}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-2">
        <button
          onClick={() => void pruefen()}
          disabled={prueft}
          className="rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 px-2.5 py-1.5 text-xs text-zinc-100"
        >
          {prueft ? 'Prüfe…' : 'Verbindung prüfen'}
        </button>
        {befund && (
          <span className={`text-[11px] ${befund.ok ? 'text-emerald-400' : 'text-red-400'}`}>
            {befund.text}
          </span>
        )}
      </div>
    </div>
  )
}
