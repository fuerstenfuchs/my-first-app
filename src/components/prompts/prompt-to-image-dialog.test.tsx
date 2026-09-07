/**
 * Geprüft wird die eine Sache, die Mark am 07.09.2026 gemeldet hat: dass beim
 * EINZELN erzeugten Körper-Sheet und Referenzsheet zwei Bilder mitgehen können
 * — und nicht nur eins (PROJ-85).
 *
 * Woran man es sonst merkt: erst am fertigen, bezahlten Bild. Ein Körper-Sheet
 * ohne das Kopfblatt sieht nicht kaputt aus, es zeigt nur ein anderes Gesicht.
 *
 * ZWEI WEGE, NICHT EINER. Die Vorbelegung ist die Bequemlichkeit, die AUSWAHL
 * VON HAND ist die eigentliche Behebung — Marks Satz war „das kann man alles
 * nicht auswählen". Beide stehen hier, und der zweite ist der wichtigere.
 *
 * Der Rest des Dialogs steht nicht zur Prüfung; Supabase kommt nicht vor.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react'
import { PromptToImageDialog } from './prompt-to-image-dialog'
import { bildplaetze } from '@/lib/referenzkette'

const anlegen = vi.fn()
const ladeBilder = vi.fn()

vi.mock('@/hooks/use-image-jobs', () => ({ useImageJobs: () => ({ anlegen }) }))
vi.mock('@/hooks/use-outfits', () => ({ useOutfits: () => ({ outfits: [], loading: false }) }))
vi.mock('@/hooks/use-locations', () => ({ useLocations: () => ({ locations: [], loading: false }) }))
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }))

/*
  ECHTE SPEICHERADRESSEN, KEINE PLATZHALTER.

  Der Dialog belegt seit dem Critic-Befund nur Bilder aus dem EIGENEN Speicher
  vor — der Arbeiter lehnt fremde Adressen als Referenz ab. Mit „https://x/…"
  bliebe hier alles leer, und der Test prüfte nichts.
*/
const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'
const speicher = (name: string) => `${EIGEN}/storage/v1/object/public/bilder/${name}`

const KOPFBLATT  = speicher('kopfblatt.jpg')
const KOERPERFOTO = speicher('koerperfoto.jpg')
const SONSTIGES  = speicher('sonstiges.jpg')
const TITELBILD  = speicher('titel.jpg')
const FREMD      = 'https://irgendwo-anders.example/bild.jpg'
/** Was `/api/referenz-holen` fuer ein fremdes Bild zurueckgibt. */
const GEHOLT     = speicher('geholt.jpg')

const PERSON = { id: 'c1', name: 'Anna', cover_image_url: TITELBILD }

vi.mock('@/hooks/use-characters', () => ({
  useCharacters: () => ({ characters: [{ id: 'c1', name: 'Anna', cover_image_url: TITELBILD }], loading: false }),
}))

vi.mock('@/lib/reference-images', () => ({
  loadRefImages: (...a: unknown[]) => ladeBilder(...a),
}))

/*
  EIN KLEINES SUPABASE-DOPPEL FUER DEN ABLAGE-WEG (PROJ-86).

  Ohne das war der ganze Zweig „Fach suchen, sonst anlegen" ungetestet — 782
  gruene Tests sagten darueber nichts. Das Doppel kann genau die zwei Ketten,
  die der Dialog benutzt: eine Liste holen und eine Zeile einfuegen.
*/
let faecher: { id: string; name: string }[] = []
/** Was der Dialog beim Anlegen eines Fachs zurueckbekommt. */
type Einfuegen = (zeile: unknown) => Promise<{ data: { id: string } | null }>
let einfuegen: Mock<Einfuegen>

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ limit: async () => ({ data: faecher }) }),
      }),
      insert: (zeile: unknown) => ({
        select: () => ({ single: async () => einfuegen(zeile) }),
      }),
    }),
  }),
}))

const ABLAGE = {
  baustein: 'charaktere' as const,
  parentId: 'c1',
  parentName: 'Anna',
  variantId: null,
  variantName: 'Körper',
}

function zeichne(
  mitPlaetzen: boolean,
  person: typeof PERSON | null = PERSON,
  ablage: typeof ABLAGE | null = null,
) {
  return render(
    <PromptToImageDialog
      isOpen
      onClose={() => {}}
      prompt="a body sheet prompt"
      vorauswahlCharakter={person}
      rollen={['character']}
      bildplaetze={mitPlaetzen ? bildplaetze('koerper', { hatKoerperfoto: true }) : undefined}
      ablage={ablage}
    />,
  )
}

/** Warten, bis die Vorbelegung durch ist, dann abschicken. */
async function abschicken() {
  await waitFor(() => expect(ladeBilder).toHaveBeenCalled())
  fireEvent.click(await screen.findByRole('button', { name: /Zur Warteschlange/i }))
  await waitFor(() => expect(anlegen).toHaveBeenCalled())
  return anlegen.mock.calls[0][0]
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', EIGEN)
  // Die Hol-Route wird nur fuer fremde Adressen ueberhaupt angerufen.
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true, json: async () => ({ url: GEHOLT }),
  })))
  anlegen.mockReset()
  anlegen.mockResolvedValue({ id: 'j1' })
  faecher = []
  einfuegen = vi.fn(async () => ({ data: { id: 'neu' } }))
  ladeBilder.mockReset()
  ladeBilder.mockResolvedValue([
    { url: KOPFBLATT,   label: 'Kopf' },
    { url: KOERPERFOTO, label: 'Körper Original' },
    { url: SONSTIGES,   label: 'Sonstiges' },
  ])
})
afterEach(() => { cleanup(); vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('Zwei Bildplätze beim Körper-Sheet', () => {
  it('zeigt zwei verschieden beschriftete Karten', async () => {
    zeichne(true)
    expect(await screen.findByText('Kopf-Sheet')).toBeTruthy()
    expect(screen.getByText('Körperfoto')).toBeTruthy()
  })

  it('schickt BEIDE Bilder mit — das war der gemeldete Fehler', async () => {
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.reference_urls).toEqual([KOPFBLATT, KOERPERFOTO])
  })

  it('sagt dem Modell, WOFUER jedes der beiden Bilder steht', async () => {
    /*
      Ohne eigene Zeilen staende zweimal „Image N = CHARACTER" — fuer zwei
      Bilder, die Verschiedenes beitragen sollen. Und der Prompt selbst verlangt
      ausdruecklich, den Kopfwinkel „from the matching view in the head
      reference sheet" zu nehmen; ohne Benennung weiss das Modell nicht, welches
      Bild das ist.
    */
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.prompt).toContain('Image 1 = HEAD REFERENCE SHEET')
    expect(auftrag.prompt).toContain('Image 2 = ORIGINAL PHOTO')
    expect(auftrag.prompt).toContain('Completely ignore any face')
  })
})

describe('Auswahl von Hand — Marks eigentliche Beschwerde', () => {
  /** Den Platz mit dieser Überschrift öffnen und dort ein Bild wählen. */
  async function waehle(platz: string, bildLabel: string) {
    const karte = (await screen.findByText(platz)).closest('div.overflow-hidden')!
    fireEvent.click(within(karte as HTMLElement).getByRole('button', { name: /wählen|ändern|Anna/i }))

    // Der Waehler ist ein eigener Dialog; „Anna" steht auch auf der Karte
    // dahinter. Ueber seinen Titel eingegrenzt, sonst trifft man die falsche.
    const waehler = (await screen.findByText('Charakter wählen')).closest('div[role="dialog"]')!
    fireEvent.click(within(waehler as HTMLElement).getByText('Anna'))
    fireEvent.click(await screen.findByText(bildLabel))
  }

  it('legt ein von Hand gewaehltes Bild in GENAU den Platz, der geoeffnet wurde', async () => {
    /*
      DIE LUECKE, DIE CRITIC GEFUNDEN HAT.

      Alle bisherigen Tests haben nur die Vorbelegung geprueft. Ein Fehler im
      Zuweisungsindex — jede Auswahl landet im ersten Platz — waere gruen
      durchgekommen, und das Kopfblatt waere durch das Koerperbild ueberschrieben
      worden. Genau der gemeldete Fehler, nur an anderer Stelle.
    */
    zeichne(true)
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())
    await waehle('Körperfoto', 'Sonstiges')

    const auftrag = await abschicken()
    // Der ERSTE Platz muss unberuehrt geblieben sein.
    expect(auftrag.reference_urls).toEqual([KOPFBLATT, SONSTIGES])
  })

  it('leert mit dem Kreuz NUR den einen Platz', async () => {
    zeichne(true)
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())
    fireEvent.click(await screen.findByRole('button', { name: 'Kopf-Sheet entfernen' }))

    const auftrag = await abschicken()
    expect(auftrag.reference_urls).toEqual([KOERPERFOTO])
  })
})

describe('Wenn das Kopfblatt fehlt', () => {
  it('beruft sich die verbliebene Zeile NICHT auf ein Bild, das nicht mitgeht', async () => {
    /*
      DER SCHWERSTE BEFUND DER PRUEFUNG.

      Die uebliche Zeile zum zweiten Bild lautet „Completely ignore any face
      visible in it; the head reference ABOVE alone decides the face". Ohne das
      Kopfblatt bekaeme das Modell EIN Bild und die Anweisung, dessen Gesicht zu
      ignorieren — es haette dann gar keine Gesichtsquelle mehr und erfaende
      eine. Am Blatt sieht man das nicht: Es ist in Ordnung, es zeigt nur einen
      Fremden.
    */
    ladeBilder.mockResolvedValue([{ url: KOERPERFOTO, label: 'Körper Original' }])
    zeichne(true)
    const auftrag = await abschicken()

    expect(auftrag.reference_urls).toEqual([KOERPERFOTO])
    expect(auftrag.prompt).toContain('Image 1 = ORIGINAL PHOTO OF THE PERSON')
    expect(auftrag.prompt).toContain('It is the only reference.')
    // Kein Verweis ins Leere und keine Anweisung, das einzige Gesicht
    // wegzuwerfen. („the text above" im Vorrangsatz meint den Prompt, nicht ein
    // Bild — deshalb wird die Bildstelle genau benannt statt nur „above".)
    expect(auftrag.prompt).not.toContain('head reference above')
    expect(auftrag.prompt).not.toContain('Completely ignore any face')
  })

  it('sagt es auch auf dem Bildschirm', async () => {
    // Ein leerer Platz ist sonst still, und das Blatt entsteht trotzdem.
    ladeBilder.mockResolvedValue([{ url: KOERPERFOTO, label: 'Körper Original' }])
    zeichne(true)
    expect(await screen.findByText(/Ohne „Kopf-Sheet"/)).toBeTruthy()
  })

  it('schweigt, wenn beide Plaetze belegt sind', async () => {
    zeichne(true)
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/^Ohne /)).toBeNull())
  })
})

describe('Vorbelegung', () => {
  it('nimmt aus jeder Variante das richtige Bild, nicht das erste beste', async () => {
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.reference_urls).not.toContain(SONSTIGES)
  })

  it('vergleicht Variantennamen ohne Rücksicht auf Leerzeichen und Grossschreibung', async () => {
    // Ueberall sonst im Projekt wird getrimmt und kleingeschrieben verglichen.
    ladeBilder.mockResolvedValue([
      { url: KOPFBLATT, label: '  kopf ' },
      { url: KOERPERFOTO, label: 'KÖRPER ORIGINAL' },
    ])
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.reference_urls).toEqual([KOPFBLATT, KOERPERFOTO])
  })

  it('faellt beim Koerperbild auf das Titelbild zurueck', async () => {
    ladeBilder.mockResolvedValue([{ url: KOPFBLATT, label: 'Kopf' }])
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.reference_urls).toEqual([KOPFBLATT, TITELBILD])
  })

  it('belegt auch mit einem fremden Bild vor und holt es beim Abschicken', async () => {
    /*
      BIS PROJ-86 BLIEB DER PLATZ HIER LEER.

      Der Arbeiter lehnt Adressen ausserhalb des eigenen Speichers ab, und ein
      still gefuellter Platz haette zu einem Auftrag gefuehrt, der sicher
      scheitert. Seit `referenzenSichern` wird das Bild stattdessen vorher
      geholt — Mark: „dass die Bilder auf jeden Fall genommen werden, egal wo
      sie herkommen und welche Endung sie haben."
    */
    ladeBilder.mockResolvedValue([
      { url: FREMD, label: 'Kopf' },
      { url: KOERPERFOTO, label: 'Körper Original' },
    ])
    zeichne(true)
    const auftrag = await abschicken()
    expect(auftrag.reference_urls).toEqual([GEHOLT, KOERPERFOTO])
  })

  it('kommt ohne vorausgewaehlten Charakter zurecht', async () => {
    zeichne(true, null)
    expect(await screen.findByText('Kopf-Sheet')).toBeTruthy()
    expect(ladeBilder).not.toHaveBeenCalled()
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
    expect(auftrag.reference_urls).toEqual([TITELBILD])
    expect(auftrag.prompt).toContain('body identity of this person')
  })
})

describe('Zweimal dasselbe Bild', () => {
  it('sagt Bescheid, wenn in beiden Plaetzen dasselbe liegt', async () => {
    /*
      Ist das Titelbild zugleich das Kopfblatt, geht dieselbe Adresse zweimal
      mit: einmal mit „take the face", einmal mit „ignore any face". Zwei
      gegenlaeufige Anweisungen fuer EIN Bild — welcher das Modell folgt, sieht
      man erst am Ergebnis.
    */
    ladeBilder.mockResolvedValue([{ url: TITELBILD, label: 'Kopf' }])
    zeichne(true)
    expect(await screen.findByText(/In zwei Plätzen liegt dasselbe Bild/)).toBeTruthy()
  })

  it('schweigt bei zwei verschiedenen Bildern', async () => {
    zeichne(true)
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByText(/dasselbe Bild/)).toBeNull())
  })
})

describe('Ablage beim Charakter', () => {
  it('nimmt das vorhandene Fach, statt ein zweites anzulegen', async () => {
    // Die drei Kettenfaecher stehen an jedem Charakter schon bereit (PROJ-50).
    // Ein zweites danebenzulegen hiesse, die Blaetter desselben Charakters auf
    // zwei Faecher zu verteilen, ohne dass etwas meldet.
    faecher = [{ id: 'f1', name: ' körper ' }]
    zeichne(true, PERSON, ABLAGE)
    const auftrag = await abschicken()

    expect(auftrag.scene_meta.ablage).toMatchObject({
      baustein: 'charaktere', parentId: 'c1', variantId: 'f1', variantName: 'Körper',
    })
    expect(einfuegen).not.toHaveBeenCalled()
  })

  it('legt ein Fach an, wenn es keins gibt — mit sort_order', async () => {
    faecher = [{ id: 'a', name: 'Kopf' }, { id: 'b', name: 'Ausdrücke' }]
    zeichne(true, PERSON, ABLAGE)
    const auftrag = await abschicken()

    expect(einfuegen).toHaveBeenCalledWith(expect.objectContaining({
      character_id: 'c1', name: 'Körper', sort_order: 2,
    }))
    expect(auftrag.scene_meta.ablage).toMatchObject({ variantId: 'neu' })
  })

  it('erzeugt TROTZDEM, wenn das Fach nicht angelegt werden kann', async () => {
    // Eine bezahlte Erzeugung an einem fehlgeschlagenen Ordner scheitern zu
    // lassen, waere die teurere Reaktion. Das Bild bleibt dann in der
    // Warteschlange.
    einfuegen = vi.fn(async () => ({ data: null }))
    zeichne(true, PERSON, ABLAGE)
    const auftrag = await abschicken()

    expect(auftrag.scene_meta.ablage).toBeUndefined()
    expect(auftrag.reference_urls.length).toBeGreaterThan(0)
  })

  it('fragt gar nicht erst nach, wenn kein Ziel mitgegeben wurde', async () => {
    zeichne(true, PERSON, null)
    const auftrag = await abschicken()
    expect(auftrag.scene_meta.ablage).toBeUndefined()
    expect(einfuegen).not.toHaveBeenCalled()
  })
})

describe('Zwei schnelle Klicks', () => {
  it('reihen NUR EINEN Auftrag ein und legen NUR EIN Fach an', async () => {
    /*
      WAS DIESER TEST FESTHAELT — UND WAS NICHT.

      Er haelt fest: Zwei Klicks ergeben EINEN Auftrag und EIN Fach. Das ist die
      Zusage, die zaehlt, denn an diesem Durchlauf haengen eine bezahlte
      Erzeugung und ein Ordner-Eintrag.

      Er unterscheidet NICHT zwischen der Sperre im Ref und der im State:
      nachgemessen, beide Fassungen laufen hier gruen durch. React leert den
      Zustand zwischen zwei Klick-Ereignissen. Wer den Test als Beleg fuer die
      Notwendigkeit des Refs liest, liest mehr hinein, als drinsteht.
    */
    zeichne(true, PERSON, ABLAGE)
    await waitFor(() => expect(ladeBilder).toHaveBeenCalled())

    const knopf = screen.getByRole('button', { name: /Zur Warteschlange/i })
    fireEvent.click(knopf)
    fireEvent.click(knopf)

    await waitFor(() => expect(anlegen).toHaveBeenCalled())
    expect(anlegen).toHaveBeenCalledTimes(1)
    expect(einfuegen).toHaveBeenCalledTimes(1)
  })
})
