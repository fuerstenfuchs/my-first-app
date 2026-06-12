interface Props {
  visible: boolean
}

export function CopyToast({ visible }: Props) {
  return (
    <div
      className={`fixed bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 shadow-xl text-sm font-medium text-zinc-100 transition-all duration-200 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
    >
      <svg className="h-4 w-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
      <span>Prompt kopiert</span>
      <span className="text-zinc-500 font-normal">– Bereit zum Einfügen.</span>
    </div>
  )
}
