/**
 * Die Seite „Personenbilder" (PROJ-92) — die Wege, an denen Geld hängt und
 * Marks Wünsche vom 29.09.2026:
 *  - alles auf einmal (drei Formate → drei Aufträge, die Zahl steht vorher auf dem Knopf),
 *  - Person, Outfit, Körperform gehen richtig beschriftet ans Modell,
 *  - die Ablage beim Charakter,
 *  - die Körperkarte und die eigenen Presets.
 *
 * Supabase und die Hooks sind ersetzt; geprüft wird die Seite, nicht die Datenbank.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react'
import PersonenbilderPage from './page'

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'
const speicher = (n: string) => `${EIGEN}/storage/v1/object/public/bilder/${n}`

const anlegen = vi.fn()
const presetAnlegen = vi.fn()
const ladeBilder = vi.fn()
const einfuegenFach = vi.fn()

vi.mock('@/components/ui/sidebar', () => ({ SidebarTrigger: () => null }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

vi.mock('@/hooks/use-characters', () => ({
  useCharacters: () => ({
    loading: false,
    characters: [
      { id: 'c1', name: 'Anna', cover_image_url: speicher('anna.jpg') },
      { id: 'c2', name: 'Berta', cover_image_url: null },
    ],
  }),
}))
vi.mock('@/hooks/use-outfits', () => ({
  useOutfits: () => ({
    loading: false,
    outfits: [
      { id: 'o1', name: 'Abendkleid', category: 'komplett', cover_image_url: speicher('kleid.jpg') },
      { id: 'o2', name: 'Mantel', category: 'komplett', cover_image_url: speicher('mantel.jpg') },
    ],
  }),
}))
vi.mock('@/hooks/use-image-jobs', () => ({
  useImageJobs: () => ({ jobs: [], anlegen }),
  ergebnisUrl: (p: string) => `${EIGEN}/storage/v1/object/public/generated-images/${p}`,
}))
vi.mock('@/hooks/use-koerper-presets', () => ({
  useKoerperPresets: () => ({
    presets: [{ id: 'p1', name: 'Model', merkmale: { taille: 'sehr_schmal', beinlaenge: 'sehr_lang' }, koerperBild: null }],
    laedt: false, fehler: null,
    anlegen: presetAnlegen, ueberschreiben: vi.fn(async () => true),
    umbenennen: vi.fn(async () => true), loeschen: vi.fn(async () => true),
    neuLaden: vi.fn(),
  }),
}))
vi.mock('@/lib/reference-images', () => ({ loadRefImages: (...a: unknown[]) => ladeBilder(...a) }))
vi.mock('@/lib/referenzen-sichern', () => ({
  referenzenSichern: async (urls: string[]) => ({ urls, geholt: 0, gescheitert: [] }),
  sicherungsMeldung: () => null,
}))
vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: [] }), single: async () => ({ data: { metadata: {} } }) }) }),
      insert: (z: unknown) => ({ select: () => ({ single: async () => einfuegenFach(z) }) }),
    }),
  }),
}))

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', EIGEN)
  anlegen.mockReset(); anlegen.mockResolvedValue({ id: 'j' })
  presetAnlegen.mockReset(); presetAnlegen.mockResolvedValue({ id: 'p2', name: 'Neu', merkmale: {}, koerperBild: null })
  einfuegenFach.mockReset(); einfuegenFach.mockResolvedValue({ data: { id: 'fach1' } })
  ladeBilder.mockReset()
  ladeBilder.mockImplementation(async (tabelle: string) =>
    tabelle === 'character_variants'
      ? [{ url: speicher('sheet.png'), label: 'Referenzsheet' }]
      : [{ url: speicher('outfit-sheet.png'), label: 'Referenzsheet' }])
})
afterEach(() => { cleanup(); vi.unstubAllEnvs() })

async function waehlePersonUndOutfit() {
  fireEvent.click(await screen.findByRole('button', { name: /Anna/ }))
  fireEvent.click(screen.getByRole('tab', { name: /03 — OUT/ }))
  fireEvent.click(await screen.findByRole('button', { name: /Abendkleid/ }))
  await waitFor(() => expect(ladeBilder).toHaveBeenCalledTimes(2))
}

describe('Die vier Felder', () => {
  it('zeigen Person, Körper, Outfit, Format — und was gewählt ist', async () => {
    render(<PersonenbilderPage />)
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual([
      expect.stringContaining('01 — PER'), expect.stringContaining('02 — KÖR'),
      expect.stringContaining('03 — OUT'), expect.stringContaining('04 — FMT'),
    ])
    await waehlePersonUndOutfit()
    expect(screen.getByRole('tab', { name: /01 — PER/ }).textContent).toContain('Anna')
    expect(screen.getByRole('tab', { name: /03 — OUT/ }).textContent).toContain('Abendkleid')
  })

  it('zeigt bei jedem Outfit das Vorschaubild', async () => {
    render(<PersonenbilderPage />)
    fireEvent.click(screen.getByRole('tab', { name: /03 — OUT/ }))
    const kachel = await screen.findByRole('button', { name: /Mantel/ })
    expect(kachel.querySelector('img')).not.toBeNull()
  })
})

describe('Alles auf einmal', () => {
  it('sagt VOR dem Klick, wie viele Bilder es werden', async () => {
    render(<PersonenbilderPage />)
    await waehlePersonUndOutfit()
    expect(screen.getByRole('button', { name: '1 Bild erzeugen' })).toBeTruthy()      // Vorgabe: Referenzsheet
    fireEvent.click(screen.getByRole('tab', { name: /04 — FMT/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Alle drei' }))
    expect(screen.getByRole('button', { name: '3 Bilder erzeugen' })).toBeTruthy()
  })

  it('reiht drei Aufträge ein, in fester Reihenfolge, mit Ablage beim Charakter', async () => {
    render(<PersonenbilderPage />)
    await waehlePersonUndOutfit()
    fireEvent.click(screen.getByRole('tab', { name: /04 — FMT/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Alle drei' }))
    fireEvent.click(screen.getByRole('button', { name: '3 Bilder erzeugen' }))

    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(3))
    const formate = anlegen.mock.calls.map(c => c[0].scene_meta.format)
    expect(formate).toEqual(['vorn', 'vier', 'sheet'])

    const erster = anlegen.mock.calls[0][0]
    expect(erster.reference_urls).toEqual([speicher('sheet.png'), speicher('outfit-sheet.png')])
    expect(erster.reference_roles).toEqual(['character', 'outfit'])
    expect(erster.variants).toBe(1)
    expect(erster.scene_meta.ablage).toMatchObject({
      baustein: 'charaktere', parentId: 'c1', variantId: 'fach1', variantName: 'Personenbild',
    })
    // Alle drei gehören zu EINEM Durchlauf.
    expect(new Set(anlegen.mock.calls.map(c => c[0].scene_meta.personenbild_id)).size).toBe(1)
  })

  it('bricht beim ersten Fehler ab und schickt nicht blind weiter', async () => {
    anlegen.mockReset()
    anlegen.mockResolvedValueOnce({ id: 'j1' }).mockResolvedValueOnce(null)
    render(<PersonenbilderPage />)
    await waehlePersonUndOutfit()
    fireEvent.click(screen.getByRole('tab', { name: /04 — FMT/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Alle drei' }))
    fireEvent.click(screen.getByRole('button', { name: '3 Bilder erzeugen' }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(2))
    await new Promise(r => setTimeout(r, 80))
    expect(anlegen).toHaveBeenCalledTimes(2)                                   // nicht blind weiter
    // Die Auswahl schrumpft auf den Rest: ein zweiter Klick zahlt nicht alles noch einmal.
    expect(await screen.findByRole('button', { name: '2 Bilder erzeugen' })).toBeTruthy()
  })

  it('startet nichts ohne Person oder Outfit', async () => {
    render(<PersonenbilderPage />)
    const knopf = screen.getByRole('button', { name: /erzeugen/ }) as HTMLButtonElement
    expect(knopf.disabled).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('Es fehlt: Person, Outfit')
  })

  it('schickt keinen zweiten Durchlauf, solange der erste läuft (Doppelklick)', async () => {
    let frei: () => void = () => {}
    anlegen.mockReset()
    anlegen.mockImplementation(() => new Promise(r => { frei = () => r({ id: 'j' }) }))
    render(<PersonenbilderPage />)
    await waehlePersonUndOutfit()
    const knopf = screen.getByRole('button', { name: '1 Bild erzeugen' })
    fireEvent.click(knopf); fireEvent.click(knopf)
    // Erst warten, bis alles zur Ruhe kommt — sonst wäre „genau einmal" schon vorher erfüllt.
    await new Promise(r => setTimeout(r, 80))
    expect(anlegen).toHaveBeenCalledTimes(1)
    frei()
  })
})

describe('Körper', () => {
  async function zumKoerper() {
    render(<PersonenbilderPage />)
    await waehlePersonUndOutfit()
    fireEvent.click(screen.getByRole('tab', { name: /02 — KÖR/ }))
  }

  it('hat genau zwölf Punkte auf der Karte', async () => {
    const { container } = render(<PersonenbilderPage />)
    fireEvent.click(screen.getByRole('tab', { name: /02 — KÖR/ }))
    expect(container.querySelectorAll('.pb-punkt').length).toBe(12)
  })

  it('das Blender-Bild fällt weg, sobald seine Region anders gesetzt wird (Critic-Blocker 2)', async () => {
    await zumKoerper()
    fireEvent.click(screen.getAllByRole('button', { name: /Sehr ausladend/ })[0])   // Bild + Stufe
    fireEvent.click(screen.getByRole('button', { name: 'Schmal' }))                 // Region anders gesetzt
    fireEvent.click(screen.getByRole('button', { name: '1 Bild erzeugen' }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(1))
    const a = anlegen.mock.calls[0][0]
    expect(a.reference_urls.length).toBe(2)                                          // kein Körperbild mehr
    expect(a.prompt).toContain('narrow hips')
    expect(a.prompt).not.toContain('BODY SHAPE REFERENCE')
  })

  it('das Blender-Bild bleibt, wenn eine ANDERE Region gesetzt wird', async () => {
    await zumKoerper()
    fireEvent.click(screen.getAllByRole('button', { name: /Sehr ausladend/ })[0])
    fireEvent.click(screen.getByRole('button', { name: /^10 · Beinlänge/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Lang' }))
    fireEvent.click(screen.getByRole('button', { name: '1 Bild erzeugen' }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(1))
    expect(anlegen.mock.calls[0][0].reference_urls.length).toBe(3)
  })

  it('ein Blender-Extrem setzt die Stufe UND das Körperbild, und beides geht mit ans Modell', async () => {
    await zumKoerper()
    // Aktive Region ist Becken: das Bild-Extrem steht vor dem reinen Stufenknopf.
    fireEvent.click(screen.getAllByRole('button', { name: /Sehr ausladend/ })[0])
    fireEvent.click(screen.getByRole('button', { name: '1 Bild erzeugen' }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(1))
    const a = anlegen.mock.calls[0][0]
    expect(a.reference_urls[2]).toContain('koerper-presets/becken-sehr-ausladend.png')
    expect(a.prompt).toContain('Image 3 = BODY SHAPE REFERENCE')
    expect(a.prompt).toContain('dramatically wide, flared hips')
    expect(a.scene_meta.koerper).toEqual({ becken: 'sehr_ausladend' })
  })

  it('ein eigenes Preset setzt die ganze Auswahl auf einmal', async () => {
    await zumKoerper()
    fireEvent.click(screen.getByRole('button', { name: /Model/ }))
    fireEvent.click(screen.getByRole('button', { name: '1 Bild erzeugen' }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(1))
    const a = anlegen.mock.calls[0][0]
    expect(a.scene_meta.koerper).toEqual({ taille: 'sehr_schmal', beinlaenge: 'sehr_lang' })
    expect(a.prompt).toContain('very narrow, sharply defined waist')
    expect(a.prompt).toContain('strikingly long legs')
  })

  it('speichert die aktuelle Einstellung unter dem eingegebenen Namen', async () => {
    await zumKoerper()
    fireEvent.click(screen.getAllByRole('button', { name: /Sehr ausladend/ })[1])   // Stufenknopf, ohne Bild
    const speichern = screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement
    expect(speichern.disabled).toBe(true)                                     // ohne Namen nicht
    fireEvent.change(screen.getByLabelText('Aktuelle Einstellung speichern'), { target: { value: 'Sommer' } })
    expect(speichern.disabled).toBe(false)
    fireEvent.click(speichern)
    await waitFor(() => expect(presetAnlegen).toHaveBeenCalled())
    expect(presetAnlegen.mock.calls[0][0]).toBe('Sommer')
    expect(presetAnlegen.mock.calls[0][1]).toEqual({ becken: 'sehr_ausladend' })
  })

  it('lässt das Speichern gesperrt, wenn nichts eingestellt ist', async () => {
    await zumKoerper()
    fireEvent.change(screen.getByLabelText('Aktuelle Einstellung speichern'), { target: { value: 'Leer' } })
    expect((screen.getByRole('button', { name: 'Speichern' }) as HTMLButtonElement).disabled).toBe(true)
  })
})

describe('Ladefehler', () => {
  it('werden nicht zum Titelbild: nichts wird bezahlt, bis die Bilder da sind', async () => {
    ladeBilder.mockRejectedValue(new Error('Netz weg'))
    render(<PersonenbilderPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }))
    fireEvent.click(screen.getByRole('tab', { name: /03 — OUT/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Abendkleid/ }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Laden fehlgeschlagen'))
    expect((screen.getByRole('button', { name: /erzeugen/ }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.queryByText(/nur das Titelbild/)).toBeNull()
  })
})

describe('Modelle', () => {
  it('bietet nur die 2.5-Familie an — gpt-image-2 bleibt gesperrt', async () => {
    render(<PersonenbilderPage />)
    const optionen = Array.from((screen.getByLabelText('Modell') as HTMLSelectElement).options).map(o => o.value)
    expect(optionen.length).toBeGreaterThan(0)
    expect(optionen.every(v => v.startsWith('gpt-image-2.5'))).toBe(true)
  })
})

describe('Ohne Referenzsheet', () => {
  it('sagt, dass nur das Titelbild vorliegt, und geht trotzdem', async () => {
    ladeBilder.mockResolvedValue([])
    render(<PersonenbilderPage />)
    fireEvent.click(await screen.findByRole('button', { name: /Anna/ }))
    await waitFor(() => expect(screen.getByText(/nur das Titelbild/)).toBeTruthy())
    const zutaten = screen.getByText('Zutaten').closest('div.sb-mod') as HTMLElement
    expect(within(zutaten).getByText('Nur das Titelbild')).toBeTruthy()
  })
})
