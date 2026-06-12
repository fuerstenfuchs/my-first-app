import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { initStorage } from './lib/storage'
import type { PendingCapture } from './types'
import { LoginScreen } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'
import { QuickCaptureScreen } from './components/QuickCaptureScreen'

type State = 'loading' | 'unauthenticated' | 'authenticated' | 'quick-capture'

export function App() {
  const [state, setState] = useState<State>('loading')
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null)
  const [captureRestored, setCaptureRestored] = useState(false)

  useEffect(() => {
    initStorage().then(async () => {
      const { data: { session } } = await supabase.auth.getSession()

      const result = await chrome.storage.local.get('pendingCapture')
      const capture = result.pendingCapture as PendingCapture | undefined

      if (capture) {
        setPendingCapture(capture)
        setState(session ? 'quick-capture' : 'unauthenticated')
      } else {
        setState(session ? 'authenticated' : 'unauthenticated')
      }
    })
  }, [])

  function handleLogin() {
    if (pendingCapture) {
      setCaptureRestored(true)
      setState('quick-capture')
    } else {
      setState('authenticated')
    }
  }

  function handleCaptureBack() {
    // Preserve pendingCapture — banner shows on MainScreen
    setState('authenticated')
  }

  async function handleCaptureDiscard() {
    await chrome.storage.local.remove('pendingCapture')
    setPendingCapture(null)
    setState('authenticated')
  }

  function handleCaptureSaved() {
    setPendingCapture(null)
    setCaptureRestored(false)
    setState('authenticated')
    setTimeout(() => window.close(), 800)
  }

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (state === 'unauthenticated') {
    return <LoginScreen onLogin={handleLogin} />
  }

  if (state === 'quick-capture' && pendingCapture) {
    return (
      <QuickCaptureScreen
        capture={pendingCapture}
        captureRestored={captureRestored}
        onSaved={handleCaptureSaved}
        onBack={handleCaptureBack}
        onDiscard={handleCaptureDiscard}
      />
    )
  }

  return (
    <MainScreen
      onLogout={() => setState('unauthenticated')}
      pendingCapture={pendingCapture}
      onOpenCapture={() => setState('quick-capture')}
    />
  )
}
