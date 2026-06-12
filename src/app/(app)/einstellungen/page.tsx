'use client'

import { useRef, useState } from 'react'
import { Download, Settings, Smartphone, Upload } from 'lucide-react'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { usePrompts } from '@/hooks/use-prompts'
import { usePwaInstall } from '@/components/pwa-install-banner'

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

  async function handleInstall() {
    const accepted = await install()
    if (accepted) toast.success('PromptDB wurde installiert')
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
        toast.error('Ungültige Datei — bitte eine gültige PromptDB-JSON-Datei wählen')
        return
      }
      if (!Array.isArray(parsed)) {
        toast.error('Ungültige Datei — bitte eine gültige PromptDB-JSON-Datei wählen')
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
                    Installiere PromptDB als App auf deinem Gerät, um Prompts direkt aus dem Share-Menü von Reddit, ChatGPT, Claude und anderen Apps zu speichern.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="gap-2"
                    disabled={!canInstall}
                    onClick={handleInstall}
                  >
                    <Smartphone className="h-4 w-4" />
                    PromptDB installieren
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
                Importiere Prompts aus einer zuvor exportierten PromptDB-JSON-Datei. Bestehende Prompts werden nicht verändert — es werden immer neue Einträge angelegt.
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

        </div>
      </main>
    </div>
  )
}
