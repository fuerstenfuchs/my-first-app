import { describe, it, expect } from 'vitest'
import {
  FORMATE, FORMAT_REIHE, PERSONENBILD_PROMPT, baueAuftraege, bilderText, fehlendes,
  outfitQuelle, personQuellen, sortiereFormate, type PersonenbildEingabe,
} from './personenbild'
import { rangVon, standardReferenz, nachNutzen } from './referenz-auswahl'
import { bereinigeMerkmale, bereinigeName, zeileZuPreset, hatInhalt } from './koerper-nutzer-presets'
import { punktLage, KARTEN_REIHE, extremeVon, gesetzteRegionen, stufenText } from './koerper-regionen'
import { MERKMAL_FELDER } from './koerper-felder'
import { ablageMitFach, type VariantenClient } from './ablage-variante'

const EIGEN = 'https://gsfrbxdesarlhfijmguu.supabase.co'
const url = (n: string) => `${EIGEN}/storage/v1/object/public/prompt-media/${n}`

const EINGABE: PersonenbildEingabe = {
  personId: 'c1', personName: 'Anna',
  personQuellen: [{ url: url('sheet.png'), art: 'sheet' }],
  outfitId: 'o1', outfitName: 'Abendkleid', outfitBild: url('kleid.png'),
  koerperBild: null, koerperAuswahl: {},
  formate: ['vorn', 'vier', 'sheet'], modell: 'gpt-image-2.5-sunburst', durchlaufId: 'lauf-1',
}

describe('Formate', () => {
  it('sind drei, in fester Reihenfolge', () => {
    expect(FORMAT_REIHE).toEqual(['vorn', 'vier', 'sheet'])
    expect(FORMATE.length).toBe(3)
  })
  it('sortiert unabhängig von der Klickreihenfolge, ohne Doppelte und Unbekannte', () => {
    expect(sortiereFormate(['sheet', 'vorn', 'vorn', 'quatsch'])).toEqual(['vorn', 'sheet'])
  })
  it('sagt die Zahl vor dem Klick', () => {
    expect(bilderText(0)).toBe('Kein Format gewählt')
    expect(bilderText(1)).toBe('1 Bild')
    expect(bilderText(3)).toBe('3 Bilder')
  })
})

describe('Bilder der Person', () => {
  it('nimmt ein Referenzsheet, wenn es eins gibt — und nur das', () => {
    const q = personQuellen([
      { url: 'k', label: 'Kopf' }, { url: 'r', label: 'Referenzsheet' }, { url: 'b', label: 'Körper' },
    ], 'titel')
    expect(q).toEqual([{ url: 'r', art: 'sheet' }])
  })
  it('nimmt sonst Kopf- und Körperblatt', () => {
    const q = personQuellen([{ url: 'k', label: 'Kopf' }, { url: 'b', label: 'Körper' }, { url: 'x', label: 'Sonstige' }], 'titel')
    expect(q).toEqual([{ url: 'k', art: 'kopf' }, { url: 'b', art: 'koerper' }])
  })
  it('hält „Kopf Original" nicht für das Kopfblatt', () => {
    expect(personQuellen([{ url: 'o', label: 'Kopf Original' }], 'titel')).toEqual([{ url: 'titel', art: 'titel' }])
  })
  it('fällt auf das Titelbild zurück, sonst auf nichts', () => {
    expect(personQuellen([], 'titel')).toEqual([{ url: 'titel', art: 'titel' }])
    expect(personQuellen([], null)).toEqual([])
  })
})

describe('Bild des Outfits', () => {
  it('nimmt das beste benannte Blatt', () => {
    expect(outfitQuelle([{ url: 'a', label: 'Sonstiges' }, { url: 'v', label: 'Vorne freigestellt' }], 'titel')).toBe('v')
  })
  it('nimmt bei Unbenanntem lieber das Titelbild', () => {
    expect(outfitQuelle([{ url: 'a', label: 'Sonstiges' }], 'titel')).toBe('titel')
  })
  it('nimmt notfalls das erste Bild, wenn es kein Titelbild gibt', () => {
    expect(outfitQuelle([{ url: 'a', label: 'Sonstiges' }], null)).toBe('a')
    expect(outfitQuelle([], null)).toBeNull()
  })
})

describe('Aufträge', () => {
  it('macht je Format einen Auftrag, in fester Reihenfolge', () => {
    const a = baueAuftraege({ ...EINGABE, formate: ['sheet', 'vorn'] })
    expect(a.map(x => x.format)).toEqual(['vorn', 'sheet'])
  })

  it('schickt Person, Outfit in dieser Reihenfolge — und benennt jedes Bild einzeln', () => {
    const [vorn] = baueAuftraege(EINGABE)
    expect(vorn.referenzUrls).toEqual([url('sheet.png'), url('kleid.png')])
    expect(vorn.prompt).toContain('Image 1 = REFERENCE SHEET OF THE PERSON')
    expect(vorn.prompt).toContain('Image 2 = OUTFIT')
    expect(vorn.rollen).toEqual(['character', 'outfit'])
  })

  it('hängt die Körperfigur als drittes Bild an und sagt, wofür sie steht', () => {
    const [vorn] = baueAuftraege({ ...EINGABE, koerperBild: url('koerper-presets/becken.png') })
    expect(vorn.referenzUrls[2]).toBe(url('koerper-presets/becken.png'))
    expect(vorn.prompt).toContain('Image 3 = BODY SHAPE REFERENCE')
  })

  it('ohne Körpervorgabe gilt der Körper der Person', () => {
    const ohne = baueAuftraege(EINGABE)[0].prompt
    expect(ohne).toContain('Take the body proportions from it as well.')
    expect(ohne).toContain('the body proportions come from the person reference.')
    expect(ohne).not.toContain('BODY SHAPE REFERENCE')
  })

  it('mit Textzeilen überstimmen sie den Körper NUR dort, wo sie etwas sagen (Critic-Blocker 1)', () => {
    const mit = baueAuftraege({ ...EINGABE, koerperAuswahl: { beinlaenge: 'sehr_lang' } })[0].prompt
    // Alles, was nicht gesetzt ist, kommt weiter aus der Person …
    expect(mit).toContain('Take the body proportions from it as well, EXCEPT where the ADDITIONAL BODY CHARACTERISTICS lines below say otherwise')
    expect(mit).not.toContain('Do NOT take its body proportions')
    // … und die gesetzte Zeile gewinnt gegen das Referenzsheet.
    expect(mit).toContain('ADDITIONAL BODY CHARACTERISTICS — these OVERRIDE the reference images')
    expect(mit).toContain('strikingly long legs')
    expect(mit).toContain('the ADDITIONAL BODY CHARACTERISTICS lines override it')
    // Der Standard-Vorrangsatz, der die Körperform überstimmt hätte, darf nicht mitgehen.
    expect(mit).not.toContain('follow the reference image for that aspect and ignore the conflicting words')
  })

  it('das Körperbild allein bestimmt den Körper — die Person nicht', () => {
    const p = baueAuftraege({ ...EINGABE, koerperBild: url('koerper-presets/x.png') })[0].prompt
    expect(p).toContain('Do NOT take its body proportions: the body-shape image below decides those.')
    expect(p).toContain('Take its body proportions')
    expect(p).toContain('the body proportions come from the body-shape image.')
  })

  it('Körperbild PLUS Zeilen: das Bild ist nur Anschauung, die Zeilen entscheiden (Critic-Blocker 2)', () => {
    const p = baueAuftraege({ ...EINGABE, koerperBild: url('koerper-presets/x.png'), koerperAuswahl: { becken: 'sehr_ausladend' } })[0].prompt
    expect(p).toContain('Use it only as a visual example for the body regions named in the ADDITIONAL BODY CHARACTERISTICS lines below')
    expect(p).toContain('those lines decide')
    expect(p).not.toContain('Take its body proportions')
  })

  it('Ganzkörper vorn ist hochformatig (2:3) — ohne eine zweite, widersprüchliche Formatansage', () => {
    const a = baueAuftraege(EINGABE)
    expect(a[0].size).toBe('1024x1536')
    expect(a[0].aspect_ratio).toBeNull()
    expect(a[0].prompt).toContain('PORTRAIT image, 2:3')
    expect(a[0].prompt).not.toContain('4:5')
    // Die Sheets folgen dem Vorbild der Kette.
    expect(a[1].size).toBe('1024x1024')
    expect(a[1].aspect_ratio).toBeNull()
  })

  it('trägt Kennung und Herkunft in scene_meta — ohne die Ablage, die setzt die Seite', () => {
    const [vorn] = baueAuftraege({ ...EINGABE, koerperAuswahl: { becken: 'sehr_schmal' } })
    expect(vorn.scene_meta).toMatchObject({
      herkunft: 'personenbild', personenbild_id: 'lauf-1', format: 'vorn',
      person_id: 'c1', outfit_id: 'o1', koerper: { becken: 'sehr_schmal' },
    })
    expect(vorn.scene_meta).not.toHaveProperty('ablage')
  })

  it('verlangt in jedem Prompt das Outfit statt der neutralen Kleidung des Körper-Sheets', () => {
    for (const f of FORMAT_REIHE) {
      expect(PERSONENBILD_PROMPT[f]).toContain('outfit of the outfit reference')
      expect(PERSONENBILD_PROMPT[f]).not.toContain('light grey or off-white')
    }
  })

  it('sagt, was fehlt', () => {
    expect(fehlendes(EINGABE)).toEqual([])
    expect(fehlendes({ ...EINGABE, personQuellen: [], outfitBild: null, formate: [] }))
      .toEqual(['Bild der Person', 'Bild des Outfits', 'Format'])
  })
})

describe('Rangfolge im Scene Builder', () => {
  it('ein Personenbild steht hinter dem Referenzsheet, aber vor Körper und Kopf', () => {
    const sortiert = nachNutzen([
      { url: 'k', label: 'Kopf' }, { url: 'p', label: 'Personenbild' }, { url: 'r', label: 'Referenzsheet' }, { url: 'b', label: 'Körper' },
    ])
    expect(sortiert.map(b => b.url)).toEqual(['r', 'p', 'b', 'k'])
  })
  it('wird aber NICHT von selbst gewählt', () => {
    expect(rangVon('Personenbild')).toBeGreaterThan(1)
    expect(standardReferenz([{ url: 'p', label: 'Personenbild' }])).toBeNull()
    expect(standardReferenz([{ url: 'p', label: 'Personenbild' }, { url: 'r', label: 'Referenzsheet' }])?.url).toBe('r')
  })
})

describe('Eigene Presets', () => {
  it('lässt nur bekannte Regionen mit bekannten Stufen durch', () => {
    expect(bereinigeMerkmale({ becken: 'sehr_schmal', beinlaenge: 'riesig', unbekannt: 'x', wade: 5 }))
      .toEqual({ becken: 'sehr_schmal' })
    expect(bereinigeMerkmale(null)).toEqual({})
    expect(bereinigeMerkmale([1, 2])).toEqual({})
  })
  it('macht aus dem Namen eine anzeigbare Zeile', () => {
    expect(bereinigeName('  Model \n Sommer  ')).toBe('Model Sommer')
    expect(bereinigeName('x'.repeat(100)).length).toBe(60)
  })
  it('verwirft Zeilen ohne Namen und Bilder außerhalb des eigenen Speichers', () => {
    expect(zeileZuPreset({ id: '1', name: '  ', merkmale: {} })).toBeNull()
    const p = zeileZuPreset({ id: '1', name: 'Model', merkmale: { taille: 'sehr_schmal' }, koerper_bild: 'https://fremd.example/x.png' })
    expect(p).toEqual({ id: '1', name: 'Model', merkmale: { taille: 'sehr_schmal' }, koerperBild: null })
  })
  it('erkennt, ob es etwas zu speichern gibt', () => {
    expect(hatInhalt({}, null)).toBe(false)
    expect(hatInhalt({ wade: 'duenn' }, null)).toBe(true)
    expect(hatInhalt({}, url('x.png'))).toBe(true)
  })
})

describe('Körperkarte', () => {
  it('hat zwölf Punkte, alle innerhalb des Bildes, alle mit Feld', () => {
    expect(KARTEN_REIHE.length).toBe(12)
    expect(new Set(KARTEN_REIHE).size).toBe(12)
    for (const k of KARTEN_REIHE) {
      const p = punktLage(k)
      expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1)
      expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(1)
      expect(MERKMAL_FELDER.some(f => f.schluessel === k)).toBe(true)
    }
  })
  it('kennt zu jeder Region zwei Blender-Extreme', () => {
    for (const k of KARTEN_REIHE) expect(extremeVon(k).length).toBe(2)
  })
  it('zeigt gesetzte Regionen in Kartenreihenfolge', () => {
    const r = gesetzteRegionen({ wade: 'sehr_duenn', bau: 'sportlich' })
    expect(r.map(x => x.schluessel)).toEqual(['bau', 'wade'])
    expect(stufenText('bau', 'sportlich')).toBe('Sportlich')
    expect(stufenText('bau', undefined)).toBeNull()
  })
})

describe('Fach beim Charakter', () => {
  function fake(vorhanden: { id: string; name: string }[], einfuegenOk = true) {
    const eingefuegt: Record<string, unknown>[] = []
    const client: VariantenClient = {
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: () => ({
        select: () => ({ eq: () => ({ limit: async () => ({ data: vorhanden }) }) }),
        insert: (zeile: Record<string, unknown>) => {
          eingefuegt.push(zeile)
          return { select: () => ({ single: async () => ({ data: einfuegenOk ? { id: 'neu' } : null }) }) }
        },
      }),
    }
    return { client, eingefuegt }
  }
  const ziel = { baustein: 'charaktere' as const, parentId: 'c1', parentName: 'Anna', variantId: null, variantName: 'Personenbild' }

  it('nimmt das vorhandene Fach, auch bei anderer Schreibweise', async () => {
    const { client, eingefuegt } = fake([{ id: 'v9', name: ' personenbild ' }])
    expect((await ablageMitFach(client, ziel))?.variantId).toBe('v9')
    expect(eingefuegt.length).toBe(0)
  })
  it('legt ein Fach an, wenn es keins gibt — mit sort_order', async () => {
    const { client, eingefuegt } = fake([{ id: 'a', name: 'Kopf' }])
    expect((await ablageMitFach(client, ziel))?.variantId).toBe('neu')
    expect(eingefuegt[0]).toMatchObject({ character_id: 'c1', name: 'Personenbild', sort_order: 1, user_id: 'u1' })
  })
  it('liefert null, wenn das Anlegen scheitert — erzeugt wird trotzdem', async () => {
    const { client } = fake([], false)
    expect(await ablageMitFach(client, ziel)).toBeNull()
  })
  it('fragt gar nicht erst, wenn das Fach schon feststeht', async () => {
    const { client } = fake([])
    expect((await ablageMitFach(client, { ...ziel, variantId: 'v1' }))?.variantId).toBe('v1')
  })
})
