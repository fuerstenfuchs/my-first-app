import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

interface Props {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError('E-Mail oder Passwort falsch.')
    } else {
      onLogin()
    }
  }

  function openForgotPassword() {
    chrome.tabs.create({ url: `${import.meta.env.VITE_APP_URL ?? 'https://promptdb.vercel.app'}/login/reset` })
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-8 gap-6">
      {/* Logo */}
      <div className="text-center">
        <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center mx-auto mb-3">
          <span className="text-white font-bold text-lg">P</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-100">PromptDB</h1>
        <p className="text-xs text-zinc-500 mt-1">Melde dich an, um deine Prompts zu nutzen</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400" htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-zinc-400" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm focus:outline-none focus:border-violet-500 transition-colors"
            placeholder="••••••••"
            required
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors mt-1"
        >
          {loading ? 'Anmelden…' : 'Anmelden'}
        </button>
      </form>

      <button
        type="button"
        onClick={openForgotPassword}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
      >
        Passwort vergessen?
      </button>
    </div>
  )
}
