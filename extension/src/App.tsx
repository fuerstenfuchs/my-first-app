import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { initStorage } from './lib/storage'
import type { PendingCapture, PendingFashionCapture, PendingLocationCapture } from './types'
import { LoginScreen } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'
import { QuickCaptureScreen } from './components/QuickCaptureScreen'
import { FashionCaptureScreen } from './components/FashionCaptureScreen'
import { LocationCaptureScreen } from './components/LocationCaptureScreen'

type State = 'loading' | 'unauthenticated' | 'authenticated' | 'quick-capture' | 'conflict' | 'fashion-capture' | 'location-capture'

export function App() {
  const [state, setState] = useState<State>('loading')
  const [pendingCapture, setPendingCapture] = useState<PendingCapture | null>(null)
  const [conflictCapture, setConflictCapture] = useState<PendingCapture | null>(null)
  const [captureRestored, setCaptureRestored] = useState(false)
  const [pendingFashionCapture, setPendingFashionCapture] = useState<PendingFashionCapture | null>(null)
  const [pendingLocationCapture, setPendingLocationCapture] = useState<PendingLocationCapture | null>(null)

  useEffect(() => {
    initStorage().then(async () => {
      const { data: { session } } = await supabase.auth.getSession()

      const result = await chrome.storage.local.get(['pendingCapture', 'pendingCaptureConflict', 'pendingFashionCapture', 'pendingLocationCapture'])
      const capture = result.pendingCapture as PendingCapture | undefined
      const conflict = result.pendingCaptureConflict as PendingCapture | undefined
      const fashionCapture = result.pendingFashionCapture as PendingFashionCapture | undefined
      const locationCapture = result.pendingLocationCapture as PendingLocationCapture | undefined

      if (locationCapture) {
        setPendingLocationCapture(locationCapture)
        setState(session ? 'location-capture' : 'unauthenticated')
      } else if (fashionCapture) {
        setPendingFashionCapture(fashionCapture)
        setState(session ? 'fashion-capture' : 'unauthenticated')
      } else if (capture && conflict) {
        setPendingCapture(capture)
        setConflictCapture(conflict)
        setState(session ? 'conflict' : 'unauthenticated')
      } else if (capture) {
        setPendingCapture(capture)
        setState(session ? 'quick-capture' : 'unauthenticated')
      } else {
        setState(session ? 'authenticated' : 'unauthenticated')
      }
    })
  }, [])

  function handleLogin() {
    if (pendingLocationCapture) {
      setState('location-capture')
    } else if (pendingFashionCapture) {
      setState('fashion-capture')
    } else if (pendingCapture) {
      setCaptureRestored(true)
      setState(conflictCapture ? 'conflict' : 'quick-capture')
    } else {
      setState('authenticated')
    }
  }

  function handleCaptureBack() {
    setCaptureRestored(false)
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

  async function handleKeepCapture() {
    await chrome.storage.local.remove('pendingCaptureConflict')
    setConflictCapture(null)
    setState('quick-capture')
  }

  async function handleReplaceCapture() {
    if (!conflictCapture) return
    await chrome.storage.local.set({ pendingCapture: conflictCapture })
    await chrome.storage.local.remove('pendingCaptureConflict')
    setPendingCapture(conflictCapture)
    setConflictCapture(null)
    setState('quick-capture')
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

  if (state === 'conflict' && pendingCapture && conflictCapture) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center p-5 gap-5">
        <div className="text-center">
          <div className="text-2xl mb-2">📝</div>
          <p className="text-sm font-semibold text-zinc-100">Ungespeicherter Capture vorhanden</p>
          <p className="text-xs text-zinc-400 mt-1">
            Du hast bereits einen Capture. Was möchtest du tun?
          </p>
        </div>
        <div className="w-full bg-zinc-800 rounded-lg border border-zinc-700 px-3 py-2.5 text-xs text-zinc-300">
          <span className="text-zinc-500 text-[10px] uppercase tracking-wide">Aktuell</span>
          <p className="mt-0.5 line-clamp-2">{pendingCapture.title || pendingCapture.source_url}</p>
        </div>
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={handleKeepCapture}
            className="w-full py-2.5 rounded-lg border border-zinc-600 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
          >
            Alten Capture behalten
          </button>
          <button
            onClick={handleReplaceCapture}
            className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm text-white font-medium transition-colors"
          >
            Durch neuen Capture ersetzen
          </button>
        </div>
      </div>
    )
  }

  if (state === 'location-capture' && pendingLocationCapture) {
    return (
      <LocationCaptureScreen
        capture={pendingLocationCapture}
        onSaved={async () => {
          await chrome.storage.local.remove('pendingLocationCapture')
          setPendingLocationCapture(null)
          setState('authenticated')
          setTimeout(() => window.close(), 800)
        }}
        onBack={() => setState('authenticated')}
      />
    )
  }

  if (state === 'fashion-capture' && pendingFashionCapture) {
    return (
      <FashionCaptureScreen
        capture={pendingFashionCapture}
        onSaved={async () => {
          await chrome.storage.local.remove('pendingFashionCapture')
          setPendingFashionCapture(null)
          setState('authenticated')
          setTimeout(() => window.close(), 800)
        }}
        onBack={() => setState('authenticated')}
      />
    )
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
