'use client'

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

const DISMISSED_KEY = 'pwa_install_dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PwaInstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already running as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY) === 'true') return

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  async function handleInstall() {
    if (!promptEvent) return
    await promptEvent.prompt()
    setVisible(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-24 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm">
      <div
        className="rounded-xl border border-white/10 bg-zinc-900/95 backdrop-blur-sm p-4 shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 rounded-lg bg-green-600/20 p-2">
            <Download className="h-4 w-4 text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">Prompt Trésor installieren</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              Installiere Prompt Trésor, um Prompts direkt aus dem Share-Menü zu speichern.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-7 text-xs px-3" onClick={handleInstall}>
                Installieren
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={handleDismiss}>
                Schließen
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Banner schließen"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function usePwaInstall() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    setIsInstalled(window.matchMedia('(display-mode: standalone)').matches)

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setPromptEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }, [])

  async function install() {
    if (!promptEvent) return false
    await promptEvent.prompt()
    const { outcome } = await promptEvent.userChoice
    setPromptEvent(null)
    return outcome === 'accepted'
  }

  return { canInstall: !!promptEvent && !isInstalled, isInstalled, install }
}
