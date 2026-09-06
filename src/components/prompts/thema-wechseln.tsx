'use client'

import { FolderInput } from 'lucide-react'
import {
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Untermenü „Thema wechseln" — ein Prompt in eine andere Gruppe schieben.
 *
 * WARUM ES DAS GIBT: Mark am 06.09.2026: „Man kann die verschiedenen Prompts
 * nicht aus einer Gruppe in eine andere übernehmen, oder? … Ich habe eine Weile
 * bei Sonstiges drin, die möchte ich woanders haben."
 *
 * Er hatte recht, und schlimmer: Die Funktion `verschieben` lag seit PROJ-63
 * fertig im Hook, ohne dass irgendein Knopf sie aufrief. Toter Code, der wie
 * eine Funktion aussah. Genau derselbe Fehler wie beim Titelbild, wo ich ihm
 * eine Bedienung beschrieben hatte, die es nicht gab.
 *
 * WARUM EIN EIGENES BAUTEIL UND NICHT ZWEIMAL DERSELBE BLOCK: Das Menü gibt es
 * in der Kachel UND in der Listenzeile. Zwei Kopien laufen beim nächsten Umbau
 * auseinander, und dann kann man in der einen Ansicht etwas, in der anderen
 * nicht — ohne dass es jemandem auffällt.
 *
 * WARUM KEIN „kein Thema": Ein Prompt ohne Thema taucht in der Übersicht
 * nirgends mehr auf und wäre nur noch über „Alle Prompts" zu finden. Ein
 * Menüpunkt, der Dinge unsichtbar macht, gehört nicht neben einen, der sie
 * einsortiert. Wer das braucht, legt ein Thema „Ablage" an.
 */
export function ThemaWechseln({
  themen, aktuellesThemaId, onVerschieben,
}: {
  themen: { id: string; name: string }[]
  /** Das Thema, in dem der Prompt gerade liegt — bekommt den Punkt davor. */
  aktuellesThemaId: string | null
  onVerschieben: (themaId: string) => void
}) {
  // Ohne Themen gibt es nichts zu wechseln; ein leeres Untermenü wäre eine
  // Einladung ins Nichts.
  if (themen.length === 0) return null

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <FolderInput className="mr-2 h-4 w-4" />
        Thema wechseln
      </DropdownMenuSubTrigger>
      {/* `lt-menue`: Menüinhalte hängen im Portal und damit ausserhalb von
          `.lt` — ohne diese Klasse blieben sie bei 11px und zu blass. */}
      <DropdownMenuSubContent className="lt-menue max-h-80 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={aktuellesThemaId ?? ''}
          onValueChange={id => { if (id !== aktuellesThemaId) onVerschieben(id) }}
        >
          {themen.map(t => (
            <DropdownMenuRadioItem key={t.id} value={t.id}>
              {t.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
