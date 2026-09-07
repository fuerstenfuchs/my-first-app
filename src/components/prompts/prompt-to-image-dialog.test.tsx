/**
 * Geprüft wird die eine Sache, die Mark am 07.09.2026 gemeldet hat: dass beim
 * EINZELN erzeugten Körper-Sheet und Referenzsheet zwei Bilder mitgehen können
 * — und nicht nur eins (PROJ-85).
 *
 * Woran man es sonst merkt: erst am fertigen, bezahlten Bild. Ein Körper-Sheet
 * ohne das Kopfblatt sieht nicht kaputt aus, es zeigt nur ein anderes Gesicht.
 *
 * Der Rest des Dialogs steht hier nicht zur Prüfung; Supabase kommt nicht vor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { PromptToImageDialog } from './prompt-to-image-dialog'
import { bildplaetze } from '@/lib/referenzkette'

const anlegen = vi.fn()
const ladeBilder = vi.fn()

vi.mock('@/hooks/use-image-jobs', () => ({ useImageJobs: () => ({ anlegen }) }))
vi.mock('@/hooks/use-outfits', () => ({ useOutfits: () => ({ outfits: [], loading: false }) }))
vi.mock('@/hooks/use-locations', () => ({ useLocations: () => ({ locations: [], loading: false }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const PERSON = { id: 'c1', name: 'Anna', cover_image_url: 'https://x/titel.jpg' }

vi.mock('@/hooks/use-characters', () => ({
  useCharacters: () => ({ characters: [PERSON], loading: false }),
}))

vi.mock('@/lib/reference-images', () => ({
  loadRefImages: (...a: unknown[]) => ladeBilder(...a),
}))

function zeichne(mitPlaetzen: boolean) {
  return render(
    <PromptToImageDialog
      isOpen
      onClose={() => {}}
      prompt="a body sheet prompt"
      vorauswahlCharakter={PERSON}
      rollen={['character']}
      bildplaetze={mitPlaetzen ? bildplaetze('koerper', { hatKoerperfoto: true }) : undefined}
    />,
  )
}

beforeEach(() => {
  anlegen.mockReset()
  anlegen.mockResolvedValue({ id: 'j1' })
  ladeBilder.mockReset()
  ladeBilder.mockResolvedValue([
    { url: 'https://x/kopfblatt.jpg', label: 'Kopf' },
    { url: 'https://x/koerperfoto.jpg', label: 'Körper Original' },
    { url: 'https://x/sonstiges.jpg', label: 'Sonstiges' },
  ])
})
afterEach(cleanup)

describe('Zwei Bildplätze beim Körper-Sheet', () => {
  it('zeigt zwei verschieden beschriftete Karten', async () => {
    zeichne(true)
    expect(await screen.findByText('Kopf-Sheet')).toBeTruthy()
    expect(screen.getByText('Körperfoto')).toBeTruthy()
  })

  it('schickt BEIDE Bilder mit — das war der gemeldete Fehler', async () => {
    zeichne(true)
    await screen.findByText('Kopf-Sheet')
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())

    const [auftrag] = anlegen.mock.calls[0]
    expect(auftrag.reference_urls).toEqual([
      'https://x/kopfblatt.jpg',
      'https://x/koerperfoto.jpg',
    ])
  })

  it('sagt dem Modell, WOFUER jedes der beiden Bilder steht', async () => {
    /*
      Ohne eigene Zeilen staende zweimal „Image N = CHARACTER" — fuer zwei
      Bilder, die Verschiedenes beitragen sollen: das eine das Gesicht, das
      andere den Koerperbau. Und der Prompt selbst verlangt ausdruecklich, den
      Kopfwinkel „from the matching view in the head reference sheet" zu
      nehmen; ohne Benennung weiss das Modell nicht, welches Bild das ist.
    */
    zeichne(true)
    await screen.findByText('Kopf-Sheet')
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())

    const [auftrag] = anlegen.mock.calls[0]
    expect(auftrag.prompt).toContain('Image 1 = HEAD REFERENCE SHEET')
    expect(auftrag.prompt).toContain('Image 2 = ORIGINAL PHOTO')
    expect(auftrag.prompt).toContain('Completely ignore any face')
  })

  it('nimmt aus jeder Variante das richtige Bild, nicht das erste beste', async () => {
    // „Sonstiges" liegt in derselben Liste. Wer nur das erste Bild naehme,
    // haenge irgendein Bild an und niemand saehe es dem Auftrag an.
    zeichne(true)
    await screen.findByText('Kopf-Sheet')
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())
    expect(anlegen.mock.calls[0][0].reference_urls).not.toContain('https://x/sonstiges.jpg')
  })

  it('faellt beim Koerperbild auf das Titelbild zurueck', async () => {
    // Wer kein eigenes Koerperfoto abgelegt hat, soll trotzdem ein zweites
    // Bild mitschicken koennen — das Ausgangsfoto zeigt den Koerperbau oft.
    ladeBilder.mockResolvedValue([{ url: 'https://x/kopfblatt.jpg', label: 'Kopf' }])
    zeichne(true)
    await screen.findByText('Kopf-Sheet')
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())
    expect(anlegen.mock.calls[0][0].reference_urls).toEqual([
      'https://x/kopfblatt.jpg',
      'https://x/titel.jpg',
    ])
  })

  it('reiht auch ein, wenn ein Platz leer bleibt', async () => {
    // Liegt das Kopfblatt in „Sonstiges", findet die Vorbelegung nichts. Der
    // Auftrag darf daran nicht scheitern — der Platz ist waehlbar, nicht Pflicht.
    ladeBilder.mockResolvedValue([{ url: 'https://x/koerperfoto.jpg', label: 'Körper Original' }])
    zeichne(true)
    await screen.findByText('Kopf-Sheet')
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())
    const [auftrag] = anlegen.mock.calls[0]
    expect(auftrag.reference_urls).toEqual(['https://x/koerperfoto.jpg'])
    // Die verbliebene Zeile muss die des KOERPERBILDES sein, nicht die des
    // Kopfblattes — sonst haenge das falsche Etikett am Bild.
    expect(auftrag.prompt).toContain('Image 1 = ORIGINAL PHOTO')
    expect(auftrag.prompt).not.toContain('HEAD REFERENCE SHEET')
  })
})

describe('Ohne Bildplätze bleibt alles wie zuvor', () => {
  it('zeigt eine einzige Charakterkarte und die Standardzuordnung', async () => {
    zeichne(false)
    expect(screen.getByText('Charakter')).toBeTruthy()
    expect(screen.queryByText('Kopf-Sheet')).toBeNull()
    // Ohne Plaetze wird gar nicht erst nach Variantenbildern gefragt.
    expect(ladeBilder).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
    await waitFor(() => expect(anlegen).toHaveBeenCalled())
    const [auftrag] = anlegen.mock.calls[0]
    expect(auftrag.reference_urls).toEqual(['https://x/titel.jpg'])
    expect(auftrag.prompt).toContain('body identity of this person')
  })
})
