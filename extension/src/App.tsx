import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { initStorage } from './lib/storage'
import { LoginScreen } from './components/LoginScreen'
import { MainScreen } from './components/MainScreen'

type State = 'loading' | 'unauthenticated' | 'authenticated'

export function App() {
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    initStorage().then(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setState(session ? 'authenticated' : 'unauthenticated')
    })
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex items-center justify-center flex-1">
        <div className="w-5 h-5 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (state === 'unauthenticated') {
    return <LoginScreen onLogin={() => setState('authenticated')} />
  }

  return <MainScreen onLogout={() => setState('unauthenticated')} />
}
