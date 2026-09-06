/**
 * Was hier geprüft wird, ist der Zweig, den man ohne Anmeldung sonst nicht zu
 * sehen bekommt: Wie sich der Knopf verhält, wenn der gewählte „Charakter"
 * eine GRUPPE ist (PROJ-84).
 *
 * Der Prompt-Bau selbst steht in `gruppen-shooting.test.ts` und
 * `shooting-kette.test.ts` und wird hier nicht wiederholt. Geprüft wird nur,
 * was der Knopf daraus macht — vor allem die eine Stelle, die Geld kostet,
 * wenn sie falsch ist: WELCHE REFERENZBILDER MITGEHEN.
 *
 * Supabase kommt nicht vor; `useImageJobs` ist ersetzt, sonst bräuchte der
 * Test eine Anmeldung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react'
import { ShootingKetteButton } from './shooting-kette-button'
import type { Scene } from '@/lib/szene-prompt'
import type { Character } from '@/hooks/use-characters'
import type { Outfit } from '@/hooks/use-outfits'
import type { Referenz } from '@/lib/image-generation'

const anlegen = vi.fn()

vi.mock('@/hooks/use-image-jobs', () => ({ useImageJobs: () => ({ anlegen }) }))
vi.mock('@/hooks/use-outfits', () => ({ useOutfits: () => ({ outfits: [] }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

// Der Ablagewaehler holt sich die Ordner des Charakters aus der Datenbank.
// Hier geht es nicht um ihn — ohne Ziel legt der Knopf nichts ab, und genau
// das ist fuer diesen Test der ruhigste Zustand.
vi.mock('@/components/ablage-waehler', () => ({
  AblageWaehler: () => null,
}))

const GRUPPE = {
  id: 'g1', name: 'Anna + Ben + Carla', tags: ['gruppe'], metadata: {},
  cover_image_url: 'https://x/blatt.jpg',
} as unknown as Character

const EINZELN = {
  id: 'c1', name: 'Anna', tags: ['frau'], metadata: {},
  cover_image_url: 'https://x/anna.jpg',
} as unknown as Character

const OUTFIT = { id: 'o1', name: 'Leinenkleid', cover_image_url: 'https://x/o.jpg' } as unknown as Outfit

function szene(character: Character | null, outfit: Outfit | null = OUTFIT): Scene {
  return {
    scene_type: 'outdoor', time_of_day: null, season: null, weather: null,
    ground: null, wind: null, light_source: null, light_style: null,
    light_modifiers: [], shot_type: null, camera_angle: null, lens: null,
    depth_of_field: null, aspect_ratio: null,
    character, outfit, location: { id: 'l1', name: 'Hafen' },
    pose: null, expression: null, camera: null, style: null, grading: null,
    background: null,
  } as unknown as Scene
}

const REFERENZEN: Referenz[] = [
  { url: 'https://x/blatt.jpg', rolle: 'character' },
  { url: 'https://x/o.jpg', rolle: 'outfit' },
  { url: 'https://x/hafen.jpg', rolle: 'location' },
]

function zeichne(character: Character | null) {
  return render(
    <ShootingKetteButton
      scene={szene(character)}
      referenzen={REFERENZEN}
      aspectRatio="landscape_16_9"
      sceneMeta={{}}
    />,
  )
}

beforeEach(() => {
  anlegen.mockReset()
  anlegen.mockResolvedValue({ id: 'j1' })
})
afterEach(cleanup)

describe('ShootingKetteButton bei einer Gruppe', () => {
  it('erkennt die Gruppe am Charakter und nennt die Zahl', () => {
    zeichne(GRUPPE)
    expect(screen.getByText(/3 Personen, an jedem Platz anders gestellt/)).toBeTruthy()
  })

  it('bietet einer Gruppe KEINEN Outfitwechsel an', () => {
    // Ein zweites Outfit ist EIN Kleidungsstueck. Es wuerde allen dreien
    // dasselbe anziehen und die Zuordnung des Blattes zerstoeren.
    zeichne(GRUPPE)
    expect(screen.queryByText('Outfitwechsel …')).toBeNull()
  })

  it('bietet ihn einem einzelnen Charakter weiterhin an', () => {
    zeichne(EINZELN)
    expect(screen.getByText('Outfitwechsel …')).toBeTruthy()
    expect(screen.getByText(/Gleiche Person, gleiches Licht/)).toBeTruthy()
  })

  it('schickt bei einer Gruppe KEIN Outfitbild mit', async () => {
    /*
      DIE STELLE, DIE GELD KOSTET.

      Die Kleidung einer Gruppe steht im Referenzblatt, eine Garnitur je Person.
      Geht daneben ein einzelnes Outfitbild mit, sagt der Text „jeder traegt
      seins" und das Bild „alle tragen das hier" — und das Bild gewinnt. Zu
      merken waere es an drei Leuten im selben Leinenkleid, nach fuenf
      bezahlten Erzeugungen.
    */
    zeichne(GRUPPE)
    fireEvent.click(screen.getByRole('button', { name: /Shooting erzeugen/ }))

    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(5))
    for (const [auftrag] of anlegen.mock.calls) {
      expect(auftrag.reference_roles).toEqual(['character', 'location'])
      expect(auftrag.reference_urls).not.toContain('https://x/o.jpg')
      expect(auftrag.prompt).toContain('GROUP OF THREE — CONSTELLATION')
    }
  })

  it('schickt es einem einzelnen Charakter weiterhin mit', async () => {
    zeichne(EINZELN)
    fireEvent.click(screen.getByRole('button', { name: /Shooting erzeugen/ }))

    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(5))
    for (const [auftrag] of anlegen.mock.calls) {
      expect(auftrag.reference_urls).toContain('https://x/o.jpg')
      expect(auftrag.prompt).not.toContain('CONSTELLATION')
    }
  })

  it('benennt das Gruppenblatt ALS BLATT und engt den Vorrang ein', async () => {
    /*
      DIE ZWEITE STELLE, DIE GELD KOSTET.

      Ohne eigene Zuordnungszeile steht im fertigen Prompt woertlich „take the
      face, hair, skin tone and body identity of THIS PERSON" — Einzahl, fuer
      ein Bild mit drei Menschen in zwei Reihen. Und der uebliche Vorrangsatz
      gaebe dem Bild recht, wenn der Text „die Person" anders beschreibt — was
      er hier absichtlich tut, naemlich kauernd und sitzend statt aufrecht in
      einer Reihe. Beides zusammen haette das Blatt entwertet, fuer das die
      ganze Kette gebaut ist.
    */
    zeichne(GRUPPE)
    fireEvent.click(screen.getByRole('button', { name: /Shooting erzeugen/ }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(5))

    for (const [auftrag] of anlegen.mock.calls) {
      expect(auftrag.prompt).toContain('Image 1 = THE GROUP SHEET')
      expect(auftrag.prompt).toContain('all three people of this group')
      expect(auftrag.prompt).toContain('WHO each person is and WHAT they wear')
      expect(auftrag.prompt).not.toContain('body identity of this person')
      expect(auftrag.prompt).not.toContain('ignore the conflicting words')
    }
  })

  it('laesst die Standardzuordnung bei einem einzelnen Charakter stehen', async () => {
    zeichne(EINZELN)
    fireEvent.click(screen.getByRole('button', { name: /Shooting erzeugen/ }))
    await waitFor(() => expect(anlegen).toHaveBeenCalledTimes(5))

    const [auftrag] = anlegen.mock.calls[0]
    expect(auftrag.prompt).toContain('body identity of this person')
    expect(auftrag.prompt).toContain('ignore the conflicting words')
    expect(auftrag.prompt).not.toContain('THE GROUP SHEET')
  })
})
