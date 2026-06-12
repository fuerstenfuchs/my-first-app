'use client'

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { QuickCaptureFAB } from '@/components/prompts/quick-capture-fab'
import { QuickCaptureModal } from '@/components/prompts/quick-capture-modal'
import { useQuickCapture } from '@/hooks/use-quick-capture'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { isOpen, open, close } = useQuickCapture()

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {children}
      </SidebarInset>
      <QuickCaptureFAB onOpen={open} />
      <QuickCaptureModal isOpen={isOpen} onClose={close} />
    </SidebarProvider>
  )
}
