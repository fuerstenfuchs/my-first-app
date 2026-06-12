interface Props {
  onClick: () => void
}

export function PendingCaptureBanner({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 bg-amber-500/10 border-b border-amber-500/20 hover:bg-amber-500/20 transition-colors text-left"
    >
      <span className="text-sm leading-none">📝</span>
      <span className="flex-1 text-xs font-medium text-amber-400">Unsaved Capture</span>
      <span className="text-xs text-amber-500/60">Öffnen →</span>
    </button>
  )
}
