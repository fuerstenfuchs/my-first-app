'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { QuickCaptureFAB } from '@/components/prompts/quick-capture-fab'
import { QuickCaptureModal } from '@/components/prompts/quick-capture-modal'
import { PwaInstallBanner } from '@/components/pwa-install-banner'
import { useQuickCapture } from '@/hooks/use-quick-capture'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, initialValues, open, close } = useQuickCapture()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
      <PwaInstallBanner />
      <QuickCaptureFAB onOpen={open} />
      <QuickCaptureModal isOpen={isOpen} onClose={close} initialValues={initialValues} />
    </SidebarProvider>
  )
}
