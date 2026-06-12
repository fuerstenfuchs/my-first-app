import { supabase } from '../lib/supabase'

interface Props {
  onLogout: () => void
}

export function Header({ onLogout }: Props) {
  async function handleLogout() {
    await supabase.auth.signOut()
    onLogout()
  }

  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-zinc-800">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
          <span className="text-white font-bold text-xs">P</span>
        </div>
        <span className="font-semibold text-sm text-zinc-100">PromptDB</span>
      </div>
      <button
        onClick={handleLogout}
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
        title="Abmelden"
      >
        Abmelden
      </button>
    </div>
  )
}
