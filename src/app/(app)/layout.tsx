'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { QuickCaptureFAB } from '@/components/prompts/quick-capture-fab'
import { QuickCaptureModal } from '@/components/prompts/quick-capture-modal'
import { PwaInstallBanner } from '@/components/pwa-install-banner'
import { useQuickCapture } from '@/hooks/use-quick-capture'
import { useFertigWache } from '@/hooks/use-fertig-wache'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // NICHT auf eine Seite verschieben und nicht entfernen: useQuickCapture hört
  // auf 'quick-capture:open-share', und page.tsx feuert das Event direkt nach
  // dem Mount (Share-Target vom Handy). Ohne diesen Aufruf im Layout landet
  // alles Geteilte im Nichts — genau das war zwischen 06/2026 und 09/2026 der
  // Fall. Abgesichert durch layout.test.ts.
  const { isOpen, initialValues, open, close } = useQuickCapture()

  // AUCH DIESER GEHOERT INS LAYOUT UND NICHT AUF EINE SEITE (PROJ-58).
  // Mark startet Bilder im Scene Builder, in der freien Erzeugung und aus
  // gespeicherten Prompts — alle drei rufen `useImageJobs(false)` und fragen
  // den Stand gar nicht ab. Wer dort bleibt, erfuehre nie, dass etwas fertig
  // ist. Genau das war seine Beschwerde am 04.09.2026. Ein Waechter auf einer
  // Seite waere derselbe Fehler noch einmal.
  useFertigWache()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        {children}
      </SidebarInset>
      <PwaInstallBanner />
      <QuickCaptureFAB onOpen={open} />
      <QuickCaptureModal isOpen={isOpen} onClose={close} initialValues={initialValues} />
    </SidebarProvider>
  )
}
