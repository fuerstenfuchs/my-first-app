'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { Download, Loader2, Settings, Smartphone, Sparkles, Upload } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { usePrompts } from '@/hooks/use-prompts'
import { usePwaInstall } from '@/components/pwa-install-banner'
import { createClient } from '@/lib/supabase'

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

        </div>
      </main>
    </div>
  )
}
