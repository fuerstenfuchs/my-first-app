import { Suspense } from 'react'
import { ShareHandler } from './share-handler'

export default function SharePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Suspense fallback={<p className="text-muted-foreground text-sm">Wird verarbeitet…</p>}>
        <ShareHandler />
      </Suspense>
    </div>
  )
}
