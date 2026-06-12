interface Props {
  type: 'recent' | 'favorites' | 'search' | 'error'
  message?: string
}

export function EmptyState({ type, message }: Props) {
  function openApp() {
    chrome.tabs.create({ url: import.meta.env.VITE_APP_URL ?? 'https://promptdb.vercel.app' })
  }

  if (type === 'error') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 py-8 text-center">
        <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-zinc-400">{message ?? 'Keine Verbindung.'}</p>
        <p className="text-xs text-zinc-600">Bitte Internetverbindung prüfen.</p>
      </div>
    )
  }

  if (type === 'search') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 py-8 text-center">
        <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <p className="text-sm text-zinc-400">Keine Prompts gefunden.</p>
      </div>
    )
  }

  if (type === 'favorites') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-2 px-6 py-8 text-center">
        <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        <p className="text-sm text-zinc-400">Noch keine Favoriten gespeichert.</p>
        <p className="text-xs text-zinc-600">Markiere Prompts in PromptDB als Favorit.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6 py-8 text-center">
      <svg className="h-8 w-8 text-zinc-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
      </svg>
      <p className="text-sm text-zinc-400">Noch keine Prompts verwendet.</p>
      <button
        onClick={openApp}
        className="text-xs text-violet-400 hover:text-violet-300 transition-colors underline underline-offset-2"
      >
        PromptDB öffnen
      </button>
    </div>
  )
}
