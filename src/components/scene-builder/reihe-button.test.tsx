/**
 * Was hier geprüft wird, ist genau das, was Geld kostet, wenn es schiefgeht:
 * Wird ein Abbruch SICHTBAR, und kann derselbe Klick danach dieselben Bilder
 * ein zweites Mal bezahlen?
 *
 * Der Prompt-Bau selbst steht in `einstellungsreihe.test.ts` und wird hier
 * nicht wiederholt. Supabase kommt nicht vor: `useImageJobs` ist ersetzt, sonst
 * bräuchte der Test eine Anmeldung.
 *
 * Geklickt wird mit `fireEvent`, nicht mit `user-event` — letzteres ist in
 * diesem Projekt nicht installiert, und eine neue Abhängigkeit nur fürs Klicken
 * wäre der falsche Preis.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { ReiheButton } from './reihe-button'
import type { Scene } from '@/lib/szene-prompt'

const anlegen = vi.fn()
const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/hooks/use-image-jobs', () => ({
  useImageJobs: () => ({ anlegen }),
}))

vi.mock('sonner', () => ({
  toast: {
    error:   (...a: unknown[]) => toastError(...a),
    success: (...a: unknown[]) => toastSuccess(...a),
  },
}))

/** Eine Szene, die gerade genug hat, um einen Prompt zu bauen. */
const SZENE: Scene = {
  scene_type: 'indoor',
  time_of_day: null, season: null, weather: null, ground: null, wind: null,
  light_source: null, light_style: null, light_modifiers: [],
  shot_type: 'closeup', camera_angle: null, lens: null,
  depth_of_field: null, aspect_ratio: 'landscape_16_9',
  character: null, outfit: null, location: null, pose: null,
  expression: null, camera: null, style: null, grading: null,
  background: null,
}

function zeichne() {
  return render(
    <ReiheButton
      scene={SZENE}
      prompt="a test prompt"
      referenzen={[]}
      aspectRatio="landscape_16_9"
      sceneMeta={{}}
      szenenName="Test"
      modell="gpt-image-2"
      zielKlasse={null}
    />,
  )
}

/** Der orange Knopf — sein Text nennt immer die Zahl der offenen Einstellungen. */
function reihenKnopf() {
  return screen.getByRole('button', { name: /Reihe erzeugen/ })
}

beforeEach(() => {
  anlegen.mockReset()
  toastError.mockReset()
  toastSuccess.mockReset()
  // Der Fehlerfall schreibt bewusst nach `console.error`. Im Testlauf ist das
  // nur Lärm, der einen echten Fehler überdecken würde.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ReiheButton', () => {
  it('startet mit fünf Einstellungen und meldet den vollen Erfolg', async () => {
    anlegen.mockResolvedValue({ id: 'x' })
    zeichne()

    expect(reihenKnopf()).toHaveTextContent('5 Einstellungen = 5 Bilder')
    fireEvent.click(reihenKnopf())

    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(5))
    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith('5 Einstellungen eingereiht', expect.anything()),
    )
    // Volle Reihe: Die Auswahl BLEIBT stehen, damit dieselbe Reihe mit
    // geändertem Licht wiederholt werden kann.
    expect(reihenKnopf()).toHaveTextContent('5 Einstellungen = 5 Bilder')
  })

  it('meldet einen geworfenen Fehler MIT der Zahl der bezahlten Bilder', async () => {
    // Zwei kommen durch, dann reißt die Verbindung ab — der Fall, der vorher
    // als unbehandelte Promise-Ablehnung lautlos verschwand.
    anlegen
      .mockResolvedValueOnce({ id: '1' })
      .mockResolvedValueOnce({ id: '2' })
      .mockRejectedValueOnce(new Error('Failed to fetch'))
    zeichne()

    fireEvent.click(reihenKnopf())

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][0]).toBe('Abgebrochen nach 2 von 5 Einstellungen')
    // Kein Erfolgs-Toast obendrauf.
    expect(toastSuccess).not.toHaveBeenCalled()
    // Auch hier gilt: die zwei bezahlten fallen aus der Auswahl.
    await waitFor(() => expect(reihenKnopf()).toHaveTextContent('3 Einstellungen = 3 Bilder'))
  })

  it('wählt nach einem Teilabbruch nur die erledigten ab', async () => {
    // Drei kommen durch, der vierte wird regulär abgelehnt (`anlegen` gibt
    // null zurück und hat den Grund selbst gemeldet).
    anlegen
      .mockResolvedValueOnce({ id: '1' })
      .mockResolvedValueOnce({ id: '2' })
      .mockResolvedValueOnce({ id: '3' })
      .mockResolvedValueOnce(null)
    zeichne()

    fireEvent.click(reihenKnopf())

    await waitFor(() =>
      expect(toastSuccess).toHaveBeenCalledWith(
        'Nur 3 von 5 Einstellungen eingereiht',
        expect.anything(),
      ),
    )
    // DER KERN: Ein zweiter Klick darf die drei bezahlten nicht wiederholen.
    await waitFor(() => expect(reihenKnopf()).toHaveTextContent('2 Einstellungen = 2 Bilder'))

    anlegen.mockResolvedValue({ id: 'neu' })
    anlegen.mockClear()
    fireEvent.click(reihenKnopf())
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(2))
  })

  it('gibt bei einem Wurf im ERSTEN Auftrag keinen Erfolg aus', async () => {
    anlegen.mockRejectedValueOnce(new Error('Failed to fetch'))
    zeichne()

    fireEvent.click(reihenKnopf())

    await waitFor(() => expect(toastError).toHaveBeenCalled())
    expect(toastError.mock.calls[0][0]).toBe('Nichts eingereiht — die Verbindung ist abgerissen')
    expect(toastSuccess).not.toHaveBeenCalled()
    // Nichts kam durch — die Auswahl bleibt vollständig.
    expect(reihenKnopf()).toHaveTextContent('5 Einstellungen = 5 Bilder')
  })

  it('sperrt „Vorschlag" während des Laufs', async () => {
    let loesen: (v: unknown) => void = () => {}
    anlegen.mockImplementation(() => new Promise(res => { loesen = res }))
    zeichne()

    const vorschlag = screen.getByRole('button', { name: 'Vorschlag' })
    expect(vorschlag).not.toBeDisabled()

    fireEvent.click(reihenKnopf())
    await waitFor(() => expect(vorschlag).toBeDisabled())

    loesen(null) // Lauf sauber beenden, damit kein offener Zustand bleibt.
    await waitFor(() => expect(vorschlag).not.toBeDisabled())
  })

  it('weist auf die Doppelerzeugung hin, solange die Szenen-Einstellung dabei ist', async () => {
    anlegen.mockResolvedValue({ id: 'x' })
    zeichne()

    // `closeup` steht in der Szene UND in der Vorbelegung.
    expect(screen.getByText(/dasselbe Bild ein zweites Mal/)).toBeInTheDocument()

    // Genau der Knopf mit der grünen Umrandung — über den Titel eindeutig,
    // der Name „Close-Up" träfe sonst auch „Extreme Close-Up".
    fireEvent.click(screen.getByTitle('Aktuelle Einstellung der Szene'))

    // Nach dem Abwählen ist der Hinweis weg — er soll nur dastehen, wenn er
    // wirklich zutrifft.
    await waitFor(() =>
      expect(screen.queryByText(/dasselbe Bild ein zweites Mal/)).not.toBeInTheDocument(),
    )
  })
})
