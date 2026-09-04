'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Bell, CheckCircle2, Download, Loader2, PlugZap, Settings, Smartphone, Sparkles, Upload, Volume2, XCircle } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import {
  MELDUNG_SCHLUESSEL, TON_SCHLUESSEL,
  schalterLesen, schalterSchreiben, meldungErlaubnisHolen,
} from '@/hooks/use-fertig-wache'
import { toast } from 'sonner'
import { usePrompts } from '@/hooks/use-prompts'
import { usePwaInstall } from '@/components/pwa-install-banner'
import { createClient } from '@/lib/supabase'
import {
  PROXY_MODELLE, PROXY_VORGABE_MODELL, PROXY_VORGABE_URL,
  proxyEinstellungenLesen, proxyEinstellungenSchreiben, proxyPruefen,
} from '@/lib/proxy-analyse'

interface ExportPrompt {
  title: string
  content: string
  description: string | null
  tags: string[]
  usage_count: number
}

function isValidPrompt(item: unknown): item is ExportPrompt {
  if (!item || typeof item !== 'object') return false
  const p = item as Record<string, unknown>
  return typeof p.title === 'string' && p.title.trim() !== '' &&
    typeof p.content === 'string' && p.content.trim() !== ''
}

export default function EinstellungenPage() {
  const { prompts, importPrompts } = usePrompts()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const { canInstall, isInstalled, install } = usePwaInstall()

  // Semantic search indexing state
  const [indexedCount, setIndexedCount] = useState<number | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [indexingProgress, setIndexingProgress] = useState(0)

  const loadIndexedCount = useCallback(async () => {
    const supabase = createClient()
    const { count, error } = await supabase
      .from('prompts')
      .select('*', { count: 'exact', head: true })
      .not('embedding', 'is', null)
    if (!error) setIndexedCount(count ?? 0)
  }, [])

  useEffect(() => { loadIndexedCount() }, [loadIndexedCount])

  // ——— Eigener Proxy ———
  // Die Werte kommen aus localStorage, also erst NACH dem ersten Rendern:
  // Auf dem Server gibt es kein localStorage, und wer hier direkt mit dem
  // gespeicherten Wert startete, bekaeme eine Hydrations-Warnung geschenkt.
  // ——— Meldung, wenn ein Bild fertig ist (PROJ-58) ———
  // Wie beim Proxy erst nach dem ersten Rendern aus dem localStorage lesen —
  // auf dem Server gibt es keinen, und ein direkter Startwert brächte eine
  // Hydrations-Warnung.
  const [meldungAn, setMeldungAn] = useState(false)
  const [tonAn, setTonAn] = useState(false)
  const [meldungVerboten, setMeldungVerboten] = useState(false)

  useEffect(() => {
    setMeldungAn(schalterLesen(MELDUNG_SCHLUESSEL))
    setTonAn(schalterLesen(TON_SCHLUESSEL))
    setMeldungVerboten(typeof Notification !== 'undefined' && Notification.permission === 'denied')
  }, [])

  /**
   * Die Erlaubnis wird HIER erfragt, aus dem Klick heraus — Browser lehnen die
   * Frage ab, wenn sie nicht aus einer Benutzerhandlung kommt. Deshalb steht
   * sie am Schalter und nicht im Wächter.
   */
  async function meldungUmschalten(an: boolean) {
    if (!an) {
      setMeldungAn(false)
      schalterSchreiben(MELDUNG_SCHLUESSEL, false)
      return
    }
    const antwort = await meldungErlaubnisHolen()
    if (antwort === 'granted') {
      setMeldungAn(true)
      schalterSchreiben(MELDUNG_SCHLUESSEL, true)
      toast.success('Benachrichtigungen sind an')
      return
    }
    setMeldungAn(false)
    setMeldungVerboten(antwort === 'denied')
    toast.error(antwort === 'nicht-unterstuetzt'
      ? 'Dieser Browser kann keine Benachrichtigungen anzeigen.'
      : 'Der Browser hat die Erlaubnis verweigert — in den Website-Einstellungen freigeben.')
  }

  function tonUmschalten(an: boolean) {
    setTonAn(an)
    if (!schalterSchreiben(TON_SCHLUESSEL, an)) {
      toast.error('Einstellung konnte nicht gespeichert werden — im privaten Fenster ist der lokale Speicher gesperrt.')
    }
  }

  const [proxyUrl, setProxyUrl] = useState(PROXY_VORGABE_URL)
  const [proxyToken, setProxyToken] = useState('')
  const [proxyModell, setProxyModell] = useState<string>(PROXY_VORGABE_MODELL)
  const [proxyPruefend, setProxyPruefend] = useState(false)
  const [proxyBefund, setProxyBefund] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    const e = proxyEinstellungenLesen()
    setProxyUrl(e.url)
    setProxyToken(e.token)
    setProxyModell(e.modell)
  }, [])

  /** Sofort speichern statt „Sichern"-Knopf — und melden, wenn der Speicher zumacht. */
  function proxyMerken(teil: { url?: string; token?: string; modell?: string }) {
    if (!proxyEinstellungenSchreiben(teil)) {
      toast.error('Einstellung konnte nicht gespeichert werden — im privaten Fenster ist der lokale Speicher gesperrt.')
    }
    setProxyBefund(null)
  }

  async function handleProxyPruefen() {
    setProxyPruefend(true)
    setProxyBefund(null)
    const ergebnis = await proxyPruefen({ url: proxyUrl, token: proxyToken, modell: proxyModell })
    setProxyPruefend(false)
    if (ergebnis.ok) {
      setProxyBefund({ ok: true, text: `${ergebnis.anzahl} Modelle erreichbar` })
      toast.success(`Proxy erreichbar — ${ergebnis.anzahl} Modelle`)
    } else {
      setProxyBefund({ ok: false, text: ergebnis.fehler })
      toast.error(ergebnis.fehler)
    }
  }

  async function handleIndexAll() {
    const supabase = createClient()
    const { data: unindexed, error } = await supabase
      .from('prompts')
      .select('id')
      .is('embedding', null)

    if (error) {
      toast.error('Fehler — Migration möglicherweise noch ausstehend')
      return
    }
    if (!unindexed || unindexed.length === 0) {
      toast.success('Alle Prompts sind bereits indiziert')
      return
    }

    setIsIndexing(true)
    setIndexingProgress(0)
    const BATCH = 20
    let processed = 0

    for (let i = 0; i < unindexed.length; i += BATCH) {
      const ids = unindexed.slice(i, i + BATCH).map(p => p.id)
      try {
        await fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
      } catch {
        // continue with next batch on transient error
      }
      processed += ids.length
      setIndexingProgress(processed)
    }

    setIsIndexing(false)
    await loadIndexedCount()
    toast.success(`${processed} Prompts indiziert`)
  }

  async function handleInstall() {
    const accepted = await install()
    if (accepted) toast.success('Prompt Trésor wurde installiert')
  }

  function handleExport() {
    if (prompts.length === 0) {
      toast.error('Keine Prompts zum Exportieren')
      return
    }
    const exportData: ExportPrompt[] = prompts.map(p => ({
      title: p.title,
      content: p.content,
      description: p.description,
      tags: p.tags,
      usage_count: p.usage_count,
    }))
    const json = JSON.stringify(exportData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const date = new Date().toISOString().split('T')[0]
    const a = document.createElement('a')
    a.href = url
    a.download = `promptdb-export-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`${prompts.length} Prompts exportiert`)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!fileInputRef.current) return
    fileInputRef.current.value = ''
    if (!file) return

    setImporting(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        toast.error('Ungültige Datei — bitte eine gültige Prompt Trésor-JSON-Datei wählen')
        return
      }
      if (!Array.isArray(parsed)) {
        toast.error('Ungültige Datei — bitte eine gültige Prompt Trésor-JSON-Datei wählen')
        return
      }
      const valid = parsed.filter(isValidPrompt)
      if (valid.length === 0 && parsed.length > 0) {
        toast.error('Ungültige Datei — keine gültigen Prompts gefunden')
        return
      }
      const count = await importPrompts(valid)
      toast.success(`${count} Prompts importiert`)
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col h-svh">
      <header className="border-b shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <SidebarTrigger />
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Einstellungen</h1>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-xl space-y-6">

          {!isInstalled && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">App installieren</CardTitle>
                  <CardDescription>
                    Installiere Prompt Trésor als App auf deinem Gerät, um Prompts direkt aus dem Share-Menü von Reddit, ChatGPT, Claude und anderen Apps zu speichern.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="gap-2"
                    disabled={!canInstall}
                    onClick={handleInstall}
                  >
                    <Smartphone className="h-4 w-4" />
                    Prompt Trésor installieren
                  </Button>
                  {!canInstall && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Installation über den Browser möglich: Menü → „Zum Startbildschirm hinzufügen" (iOS Safari) oder Adressleiste → Install-Symbol (Android Chrome).
                    </p>
                  )}
                </CardContent>
              </Card>

              <Separator />
            </>
          )}

          {/*
            PROJ-58 — Mark am 04.09.2026: „bekomme ich leider nirgendwo eine
            Meldung, dass das Bild fertig ist." Reiter-Titel und Einblendung
            sind immer an, weil sie niemanden stoeren. Die beiden hier stoeren
            und werden deshalb ausdruecklich freigeschaltet.
          */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Wenn ein Bild fertig ist</CardTitle>
              <CardDescription>
                Der Reitertitel zeigt immer an, wie viele Bilder fertig geworden sind, während du
                woanders warst — dafür ist nichts einzustellen. Zusätzlich:
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="meldung-schalter" className="flex items-center gap-2 text-sm font-medium">
                    <Bell className="h-4 w-4" />
                    Benachrichtigung vom Betriebssystem
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Erreicht dich auch, wenn das Fenster klein ist oder im Hintergrund liegt.
                    Der Browser fragt einmal um Erlaubnis.
                  </p>
                  {meldungVerboten && (
                    <p className="mt-1 text-xs text-amber-500">
                      Der Browser hat sie für diese Seite gesperrt — das lässt sich nur in seinen
                      eigenen Website-Einstellungen wieder freigeben.
                    </p>
                  )}
                </div>
                <Switch
                  id="meldung-schalter"
                  checked={meldungAn}
                  onCheckedChange={an => { void meldungUmschalten(an) }}
                />
              </div>

              <Separator />

              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Label htmlFor="ton-schalter" className="flex items-center gap-2 text-sm font-medium">
                    <Volume2 className="h-4 w-4" />
                    Kurzer Ton
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ein zweitöniges Pling. Nur hörbar, solange die Seite offen ist.
                  </p>
                </div>
                <Switch
                  id="ton-schalter"
                  checked={tonAn}
                  onCheckedChange={tonUmschalten}
                />
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daten exportieren</CardTitle>
              <CardDescription>
                Lade alle deine Prompts als JSON-Datei herunter — als lokales Backup oder zur Übertragung auf ein anderes Gerät.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleExport} className="gap-2">
                <Download className="h-4 w-4" />
                Alle Prompts exportieren
              </Button>
              <p className="mt-3 text-xs text-muted-foreground">
                Exportiert: Titel, Prompt-Text, Beschreibung, Tags, Kopiervorgänge. Nicht exportiert: Sammlungen.
              </p>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daten importieren</CardTitle>
              <CardDescription>
                Importiere Prompts aus einer zuvor exportierten Prompt Trésor-JSON-Datei. Bestehende Prompts werden nicht verändert — es werden immer neue Einträge angelegt.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="gap-2"
                disabled={importing}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {importing ? 'Importiere…' : 'Prompts importieren'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileChange}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Nur <code>.json</code>-Dateien werden akzeptiert. Prompts ohne Titel oder Prompt-Text werden übersprungen.
              </p>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-green-500" />
                Semantische Suche
              </CardTitle>
              <CardDescription>
                Indiziere deine Prompts für KI-gestützte Suche — finde Prompts nach Bedeutung, auch sprachübergreifend (z.B. Deutsch → Englisch).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {indexedCount === null ? (
                  <span>Lade Indexstatus…</span>
                ) : (
                  <span>
                    <span className="font-medium text-foreground">{indexedCount}</span>
                    {' / '}
                    <span className="font-medium text-foreground">{prompts.length}</span>
                    {' Prompts indiziert'}
                  </span>
                )}
              </div>

              {isIndexing && (
                <div className="space-y-1.5">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-300"
                      style={{ width: `${prompts.length > 0 ? Math.round((indexingProgress / prompts.length) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {indexingProgress} von {prompts.length} verarbeitet…
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="gap-2"
                disabled={isIndexing || indexedCount === prompts.length}
                onClick={handleIndexAll}
              >
                {isIndexing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Indiziere…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Alle Prompts indizieren
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Neue und bearbeitete Prompts werden automatisch indiziert. Nutze diesen Button einmalig für bestehende Prompts.
              </p>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-amber-500" />
                Eigener Proxy
              </CardTitle>
              <CardDescription>
                Bildanalysen laufen dann über deine eigene CLIProxyAPI statt über die kostenpflichtigen
                Dienste — mit den Modellen aus deinen vorhandenen Abos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

              <div className="space-y-1.5">
                <Label htmlFor="proxy-url">Adresse</Label>
                <Input
                  id="proxy-url"
                  value={proxyUrl}
                  placeholder={PROXY_VORGABE_URL}
                  onChange={e => { setProxyUrl(e.target.value); proxyMerken({ url: e.target.value }) }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proxy-token">Zugangsschlüssel</Label>
                <Input
                  id="proxy-token"
                  type="password"
                  value={proxyToken}
                  autoComplete="off"
                  placeholder="wird nur auf diesem Gerät gespeichert"
                  onChange={e => { setProxyToken(e.target.value); proxyMerken({ token: e.target.value }) }}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="proxy-modell">Modell</Label>
                <Select
                  value={proxyModell}
                  onValueChange={v => { setProxyModell(v); proxyMerken({ modell: v }) }}
                >
                  <SelectTrigger id="proxy-modell">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROXY_MODELLE.map(m => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="font-medium">{m.id}</span>
                        <span className="text-muted-foreground"> — {m.beschreibung}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={proxyPruefend}
                  onClick={handleProxyPruefen}
                >
                  {proxyPruefend
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Prüfe…</>
                    : <><PlugZap className="h-4 w-4" />Verbindung prüfen</>}
                </Button>
                {proxyBefund && (
                  <span className={`flex items-center gap-1.5 text-sm ${proxyBefund.ok ? 'text-green-600 dark:text-green-500' : 'text-destructive'}`}>
                    {proxyBefund.ok
                      ? <CheckCircle2 className="h-4 w-4 shrink-0" />
                      : <XCircle className="h-4 w-4 shrink-0" />}
                    {proxyBefund.text}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Diese Einstellung gilt <strong>nur an diesem Rechner</strong> und wandert nicht mit deinem
                Konto mit. Der Grund: Der Proxy läuft auf <code>127.0.0.1</code>, also auf dem Gerät, vor
                dem du gerade sitzt. Der Aufruf geht deshalb direkt aus dem Browser dorthin — der Server
                der App steht bei Vercel und käme an deinen PC gar nicht heran. Auf dem Handy gibt es
                keinen Proxy; dort laufen die Analysen weiter über den bezahlten Dienst. Ist der Proxy
                einmal aus, fällt die App automatisch darauf zurück und sagt es dir.
              </p>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  )
}
