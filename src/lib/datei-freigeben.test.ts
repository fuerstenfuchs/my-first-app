import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { toast } from 'sonner'
import {
  dateiOrtAus, dateiSchluessel, prozentDekodiert, gleicheDatei, vorschauPfad, darfLoeschen,
  titelbildNachLoeschen, dateiFreigeben, dateienFreigeben, zaehlfehlerMeldungZuruecksetzen,
  TITELBILD_BEIM_LOESCHEN_NACHZIEHEN, zaehlfehlerText,
  type SpeicherZugang,
} from './datei-freigeben'
import beispiele from './datei-schluessel-beispiele.json'

const BASIS = 'https://abc.supabase.co'
const OEFFENTLICH = `${BASIS}/storage/v1/object/public`
const MIGRATION = join(__dirname, '..', '..', 'supabase', 'migrations', '20260915_datei_verweise.sql')

/**
 * Ein Doppel, das mitschreibt, was gezählt und was gelöscht wurde.
 *
 * WARUM MITSCHREIBEN: Die gefährliche Richtung ist nicht „es wurde nicht
 * gelöscht", sondern „es wurde gelöscht, obwohl …". Das lässt sich nur prüfen,
 * wenn der Test sieht, dass `remove` NIE gerufen wurde.
 */
function doppel(antwort: (pfad: string) => { data: unknown; error: { message: string; code?: string } | null }) {
  const gezaehlt: { bucket: string; pfad: string }[] = []
  const geloescht: { bucket: string; pfade: string[] }[] = []
  const gelistet: { bucket: string; ordner: string; search: string }[] = []
  let loeschFehler: { message: string } | null = null
  // Wie der Speicher ohne Löschregel antwortet: kein Fehler, leere Liste.
  let leereLoeschantwort = false
  let nochDa = true
  let listFehler: { message: string } | null = null
  // Wie der echte Speicher mit Vorschaudateien umgeht: Der Browser darf sie
  // nicht löschen (erster Ordner `vorschau`, nicht die Nutzerkennung). `null`
  // heißt „normal", sonst sagt der Wert, ob das Nachsehen sie findet.
  let vorschauUnloeschbar: boolean | null = null
  const zugang: SpeicherZugang = {
    rpc: async (_fn, args) => {
      gezaehlt.push({ bucket: args.p_bucket, pfad: args.p_pfad })
      return antwort(args.p_pfad)
    },
    storage: {
      from: (bucket) => ({
        remove: async (pfade) => {
          geloescht.push({ bucket, pfade })
          if (loeschFehler) return { data: null, error: loeschFehler }
          if (vorschauUnloeschbar !== null && pfade.some(p => p.startsWith('vorschau/'))) {
            return { data: [], error: null }
          }
          return { data: leereLoeschantwort ? [] : pfade.map(name => ({ name })), error: null }
        },
        list: async (ordner, optionen) => {
          gelistet.push({ bucket, ordner, search: optionen.search })
          if (listFehler) return { data: null, error: listFehler }
          if (vorschauUnloeschbar !== null && ordner.startsWith('vorschau')) {
            return { data: vorschauUnloeschbar ? [{ name: optionen.search }] : [], error: null }
          }
          return { data: nochDa ? [{ name: optionen.search }] : [], error: null }
        },
      }),
    },
  }
  return {
    zugang, gezaehlt, geloescht, gelistet,
    setzeLoeschFehler: (f: { message: string } | null) => { loeschFehler = f },
    /** `{ data: [], error: null }` beim Löschen; `vorhanden` sagt, was das Nachsehen findet. */
    setzeLeereLoeschantwort: (vorhanden: boolean) => { leereLoeschantwort = true; nochDa = vorhanden },
    setzeListFehler: (f: { message: string } | null) => { listFehler = f },
    /** Vorschau nicht löschbar; `listTreffer` sagt, ob das Nachsehen sie noch findet. */
    setzeVorschauUnloeschbar: (listTreffer: boolean) => { vorschauUnloeschbar = listTreffer },
  }
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.mocked(toast.warning).mockClear()
  zaehlfehlerMeldungZuruecksetzen()
})

describe('gemeinsame Beispiele: Browser und Datenbank zerlegen gleich', () => {
  it('die Beispiele in der Migration sind wörtlich dieselben wie in der JSON-Datei', () => {
    const sql = readFileSync(MIGRATION, 'utf8')
    const block = sql.split('-- BEISPIELE-ANFANG')[1]?.split('-- BEISPIELE-ENDE')[0]
    expect(block, 'Markierungen in der Migration fehlen').toBeDefined()
    const ausSql = block!
      .split(/\r?\n/)
      .filter(z => z.startsWith('-- BEISPIEL '))
      .map(z => {
        const [adresse, schluessel] = z.slice('-- BEISPIEL '.length).split(' => ')
        return { adresse, schluessel: schluessel === 'NULL' ? null : schluessel }
      })
    expect(ausSql).toEqual(beispiele)
  })

  it.each(beispiele)('dateiSchluessel($adresse) = $schluessel', ({ adresse, schluessel }) => {
    expect(dateiSchluessel(adresse)).toBe(schluessel)
  })

  it.each(beispiele)('dateiOrtAus passt zum Schlüssel: $adresse', ({ adresse, schluessel }) => {
    const ort = dateiOrtAus(adresse, BASIS)
    expect(ort ? `${ort.bucket}/${ort.pfad}` : null).toBe(schluessel)
  })
})

describe('prozentDekodiert — dieselbe Regel wie public.datei_dekodiert', () => {
  it('groß- und kleingeschriebene Hex-Ziffern', () => {
    expect(prozentDekodiert('K%C3%A4se')).toBe('Käse')
    expect(prozentDekodiert('k%c3%a4se')).toBe('käse')
  })
  it('ein kaputtes %zz bleibt stehen, die gültigen Stellen werden trotzdem dekodiert', () => {
    expect(prozentDekodiert('a%20b%zz')).toBe('a b%zz')
    expect(prozentDekodiert('ende%2')).toBe('ende%2')
  })
  it('ungültiges UTF-8 lässt die GANZE Eingabe roh', () => {
    expect(prozentDekodiert('a%20b%FF')).toBe('a%20b%FF')
  })
  it('+ bleibt +', () => {
    expect(prozentDekodiert('a+b%21')).toBe('a+b!')
  })
})

describe('dateiOrtAus — was nur der Browser zusätzlich prüft', () => {
  it('Leerraum an den Rändern wie btrim in SQL', () => {
    expect(dateiOrtAus(` \t${OEFFENTLICH}/prompt-media/u1/x.png\n`, BASIS))
      .toEqual({ bucket: 'prompt-media', pfad: 'u1/x.png' })
  })
  it('leer, null, undefined → null', () => {
    expect(dateiOrtAus('', BASIS)).toBeNull()
    expect(dateiOrtAus('   ', BASIS)).toBeNull()
    expect(dateiOrtAus(null, BASIS)).toBeNull()
    expect(dateiOrtAus(undefined, BASIS)).toBeNull()
  })
  it('fremde Adresse → null (nichts löschen)', () => {
    expect(dateiOrtAus('https://example.com/bild.jpg', BASIS)).toBeNull()
  })
  it('Adresse eines ANDEREN Supabase-Projekts → null', () => {
    expect(dateiOrtAus('https://fremd.supabase.co/storage/v1/object/public/prompt-media/u1/x.png', BASIS)).toBeNull()
  })
  it('ohne bekannte Projektadresse wird keine Adresse als eigene erkannt', () => {
    expect(dateiOrtAus(`${OEFFENTLICH}/prompt-media/u1/x.png`, undefined)).toBeNull()
  })
  it('Pfad mit .. → null', () => {
    expect(dateiOrtAus(`${OEFFENTLICH}/prompt-media/u1/../u2/x.png`, BASIS)).toBeNull()
    expect(dateiOrtAus({ bucket: 'generated-images', pfad: 'u1/../u2/0.png' })).toBeNull()
  })
  it('(Bucket, Pfad)-Paar, auch mit ?v=, führendem Schrägstrich und Kodierung', () => {
    expect(dateiOrtAus({ bucket: 'generated-images', pfad: '/u1/j1/0.png?v=2' }))
      .toEqual({ bucket: 'generated-images', pfad: 'u1/j1/0.png' })
    expect(dateiOrtAus({ bucket: 'prompt-media', pfad: 'u1/mein%20bild.png' }))
      .toEqual({ bucket: 'prompt-media', pfad: 'u1/mein bild.png' })
    expect(dateiOrtAus({ bucket: '', pfad: 'u1/j1/0.png' })).toBeNull()
    expect(dateiOrtAus({ bucket: 'generated-images', pfad: '' })).toBeNull()
  })
})

describe('gleicheDatei', () => {
  it('?v= und Kodierung spielen keine Rolle', () => {
    expect(gleicheDatei(`${OEFFENTLICH}/a/u1/x.png?v=1`, `${OEFFENTLICH}/a/u1/x.png`, BASIS)).toBe(true)
    expect(gleicheDatei(`${OEFFENTLICH}/a/u1/k%C3%A4se.png`, `${OEFFENTLICH}/a/u1/k%c3%a4se.png`, BASIS)).toBe(true)
  })
  it('verschiedene Dateien und leere Werte', () => {
    expect(gleicheDatei(`${OEFFENTLICH}/a/u1/x.png`, `${OEFFENTLICH}/b/u1/x.png`, BASIS)).toBe(false)
    expect(gleicheDatei(null, `${OEFFENTLICH}/a/u1/x.png`, BASIS)).toBe(false)
  })
})

describe('titelbildNachLoeschen', () => {
  const A = `${OEFFENTLICH}/outfit-images/u1/o1/a.png`
  const B = `${OEFFENTLICH}/outfit-images/u1/o1/b.png`
  const an = { nachziehen: true, basis: BASIS }
  it('Titelbild war das gelöschte Bild → nächstes Bild', () => {
    expect(titelbildNachLoeschen('outfits', `${A}?v=4`, A, [B], an)).toEqual({ aendern: true, neu: B })
  })
  it('kein Bild mehr übrig → null', () => {
    expect(titelbildNachLoeschen('outfits', A, A, [], an)).toEqual({ aendern: true, neu: null })
  })
  it('ein Doppel derselben Datei ist kein Ersatz', () => {
    expect(titelbildNachLoeschen('outfits', A, A, [`${A}?v=2`, B], an)).toEqual({ aendern: true, neu: B })
  })
  it('anderes Titelbild oder keines → nichts ändern', () => {
    expect(titelbildNachLoeschen('outfits', B, A, [B], an)).toEqual({ aendern: false })
    expect(titelbildNachLoeschen('outfits', null, A, [B], an)).toEqual({ aendern: false })
    expect(titelbildNachLoeschen('outfits', A, null, [B], an)).toEqual({ aendern: false })
  })
  it('Marks Entscheidung vom 15.09.2026: Das Titelbild bleibt — in allen vier Bausteinen', () => {
    expect(TITELBILD_BEIM_LOESCHEN_NACHZIEHEN).toEqual({
      charaktere: false, outfits: false, locations: false, posen: false,
    })
    // Ohne ausdrückliche Option greift der Schalter: Das Titelbild zeigte auf
    // das gelöschte Bild und bleibt trotzdem stehen.
    for (const baustein of ['charaktere', 'outfits', 'locations', 'posen'] as const) {
      expect(titelbildNachLoeschen(baustein, A, A, [B], { basis: BASIS })).toEqual({ aendern: false })
    }
  })
  it('Schalter aus → Titelbild wird nicht angefasst', () => {
    expect(titelbildNachLoeschen('outfits', A, A, [B], { nachziehen: false, basis: BASIS })).toEqual({ aendern: false })
  })
})

describe('zaehlfehlerText — die richtige Ursache', () => {
  const FEHLT = 'Die Datenbankfunktion zum Zählen fehlt'
  it('„Funktion fehlt" nur bei den echten Anzeichen', () => {
    for (const fehler of [
      'Could not find the function public.datei_verweise(p_bucket, p_pfad) in the schema cache',
      'PGRST202',
      'function public.datei_verweise(text, text) does not exist',
    ]) {
      expect(zaehlfehlerText(fehler).beschreibung).toContain(FEHLT)
    }
  })
  it('die eigenen Abbrüche der Funktion zeigen ihren Grund, nicht „Funktion fehlt"', () => {
    for (const fehler of [
      // Ein Typfehler INNERHALB der Funktion — sie ist da, eine Zeile darin nicht.
      'function strpos(jsonb, text) does not exist',
      'datei_verweise: Kernstelle prompts.cover_image_url ist nicht sichtbar (fehlt oder keine Leserechte) — nichts wird freigegeben',
      'datei_verweise: Kerntabelle prompts hat RLS, aber keine Regel für SELECT — die Zählung sähe keine Zeile',
      'datei_verweise: Eimer und Pfad sind Pflicht',
    ]) {
      const t = zaehlfehlerText(fehler)
      expect(t.titel).toBe('Speicher wird nicht aufgeräumt')
      expect(t.beschreibung).not.toContain(FEHLT)
      expect(t.beschreibung).toContain(`Grund: ${fehler.slice(0, 40)}`)
    }
  })
  it('langer Grund wird gekürzt, Leerraum zusammengezogen', () => {
    const t = zaehlfehlerText(`Zeile\n\n${'x'.repeat(400)}`)
    expect(t.beschreibung).toMatch(/^Grund: Zeile x+… — /)
    expect(t.beschreibung.split(' — ')[0].length).toBeLessThanOrEqual('Grund: '.length + 160)
  })
})

describe('Hilfsregeln', () => {
  it('vorschauPfad', () => {
    expect(vorschauPfad('u1/j1/0.png')).toBe('vorschau/u1/j1/0.png.jpg')
  })
  it('darfLoeschen nur bei sauberer Null', () => {
    expect(darfLoeschen(0, null)).toBe(true)
    expect(darfLoeschen(1, null)).toBe(false)
    expect(darfLoeschen(0, { message: 'kaputt' })).toBe(false)
    expect(darfLoeschen(null, null)).toBe(false)
    expect(darfLoeschen('0', null)).toBe(false)
    expect(darfLoeschen(-1, null)).toBe(false)
    expect(darfLoeschen(0.5, null)).toBe(false)
  })
})

describe('dateiFreigeben', () => {
  const ORT = { bucket: 'generated-images', pfad: 'u1/j1/0.png' }

  it('niemand verweist → die Datei geht, die Vorschau bleibt für den Arbeiter', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e).toEqual({ status: 'geloescht', ort: ORT, vorschau: 'bleibt-fuer-arbeiter' })
    expect(d.gezaehlt.map(z => z.pfad)).toEqual(['u1/j1/0.png'])
    expect(d.geloescht).toEqual([{ bucket: 'generated-images', pfade: ['u1/j1/0.png'] }])
  })

  /*
    CRITIC B1 (15.09.2026): Der Browser kann eine Vorschau nie löschen — ihr
    erster Ordner ist `vorschau`, nicht die Nutzerkennung. Das Doppel bildet
    genau das nach, einmal in einem öffentlich lesbaren Eimer (das Nachsehen
    findet sie) und einmal in einem nur im eigenen Ordner lesbaren (es findet
    nichts). In beiden Fällen: kein Versuch, kein Alarm, und die Einmal-Marke
    bleibt frei für einen echten Löschfehler.
  */
  for (const listTreffer of [true, false]) {
    it(`Vorschau im Browser nicht löschbar (Nachsehen ${listTreffer ? 'mit' : 'ohne'} Treffer) → kein Alarm, Marke bleibt frei`, async () => {
      const d = doppel(() => ({ data: 0, error: null }))
      d.setzeVorschauUnloeschbar(listTreffer)
      const e = await dateiFreigeben(d.zugang, ORT)
      expect(e).toEqual({ status: 'geloescht', ort: ORT, vorschau: 'bleibt-fuer-arbeiter' })
      expect(d.geloescht.flatMap(x => x.pfade).some(p => p.startsWith('vorschau/'))).toBe(false)
      expect(d.gelistet.some(x => x.ordner.startsWith('vorschau'))).toBe(false)
      expect(toast.warning).not.toHaveBeenCalled()

      // Ein ECHTER Löschfehler an einer Hauptdatei danach wird weiterhin gemeldet.
      d.setzeLoeschFehler({ message: 'permission denied' })
      const zweite = await dateiFreigeben(d.zugang, { bucket: 'generated-images', pfad: 'u1/j1/1.png' })
      expect(zweite.status).toBe('loeschfehler')
      expect(toast.warning).toHaveBeenCalledTimes(1)
    })
  }

  it('Datei noch verwendet → die Vorschau wird gar nicht erst gezählt', async () => {
    const d = doppel(() => ({ data: 1, error: null }))
    await dateiFreigeben(d.zugang, ORT)
    expect(d.gezaehlt).toHaveLength(1)
    expect(d.geloescht).toEqual([])
  })

  it('bei Zählung > 0 wird NICHT gelöscht', async () => {
    const d = doppel(() => ({ data: 2, error: null }))
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e).toEqual({ status: 'noch-verwendet', ort: ORT, verweise: 2 })
    expect(d.geloescht).toEqual([])
  })

  it('bei Zählfehler wird NICHT gelöscht', async () => {
    const d = doppel(() => ({ data: null, error: { message: 'function public.datei_verweise does not exist' } }))
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('zaehlfehler')
    expect(d.geloescht).toEqual([])
  })

  it('wirft die Zählung, wird NICHT gelöscht und nicht weitergeworfen', async () => {
    const d = doppel(() => { throw new Error('Netz weg') })
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('zaehlfehler')
    expect(d.geloescht).toEqual([])
  })

  it('unerwartete Antwort (keine Zahl) wird NICHT als Null gelesen', async () => {
    for (const data of [null, undefined, '0', [], {}]) {
      const d = doppel(() => ({ data, error: null }))
      const e = await dateiFreigeben(d.zugang, ORT)
      expect(e.status).toBe('zaehlfehler')
      expect(d.geloescht).toEqual([])
    }
  })

  it('Zählfehler wird EINMAL sichtbar gemeldet, nicht bei jedem Löschen', async () => {
    const d = doppel(() => ({ data: null, error: { message: 'Could not find the function public.datei_verweise' } }))
    await dateiFreigeben(d.zugang, ORT)
    await dateiFreigeben(d.zugang, { bucket: 'generated-images', pfad: 'u1/j1/1.png' })
    await dateiFreigeben(d.zugang, { bucket: 'generated-images', pfad: 'u1/j1/2.png' })
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(vi.mocked(toast.warning).mock.calls[0][0]).toBe('Speicher wird nicht aufgeräumt')
  })

  it('der Pfad geht dekodiert an die Zählung — einmal, nicht je Schreibweise', async () => {
    const d = doppel(() => ({ data: 1, error: null }))
    await dateiFreigeben(d.zugang, `${OEFFENTLICH}/prompt-media/u1/k%c3%a4se.png?v=2`, BASIS)
    expect(d.gezaehlt).toEqual([{ bucket: 'prompt-media', pfad: 'u1/käse.png' }])
    expect(d.geloescht).toEqual([])
  })

  it('fremde oder leere Adresse: weder zählen noch löschen', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    expect((await dateiFreigeben(d.zugang, 'https://example.com/x.jpg', BASIS)).status).toBe('kein-speicherort')
    expect((await dateiFreigeben(d.zugang, null, BASIS)).status).toBe('kein-speicherort')
    expect(d.gezaehlt).toEqual([])
    expect(d.geloescht).toEqual([])
  })

  it('Adresse mit ?v= im fremden Eimer: gezählt und gelöscht wird dort, nicht im Baustein-Eimer', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    await dateiFreigeben(d.zugang, `${OEFFENTLICH}/fashion-assets/u1/f1/a.jpg?v=9`, BASIS)
    expect(d.gezaehlt).toEqual([{ bucket: 'fashion-assets', pfad: 'u1/f1/a.jpg' }])
    expect(d.geloescht).toEqual([{ bucket: 'fashion-assets', pfade: ['u1/f1/a.jpg'] }])
  })

  it('Löschfehler wird gemeldet; „nicht gefunden" gilt als erledigt', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLoeschFehler({ message: 'permission denied' })
    expect((await dateiFreigeben(d.zugang, ORT)).status).toBe('loeschfehler')
    d.setzeLoeschFehler({ message: 'Object not found' })
    expect((await dateiFreigeben(d.zugang, ORT)).status).toBe('geloescht')
  })

  it('Hauptdatei lässt sich nicht löschen → Vorschau wird weder gezählt noch gelöscht', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLoeschFehler({ message: 'permission denied' })
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('loeschfehler')
    expect(d.gezaehlt.map(z => z.pfad)).toEqual(['u1/j1/0.png'])
    expect(d.geloescht).toEqual([{ bucket: 'generated-images', pfade: ['u1/j1/0.png'] }])
  })

  it('Löschfehler wird EINMAL je Sitzung sichtbar gemeldet — getrennt vom Zählfehler', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLoeschFehler({ message: 'new row violates row-level security policy' })
    await dateiFreigeben(d.zugang, ORT)
    await dateiFreigeben(d.zugang, { bucket: 'generated-images', pfad: 'u1/j1/1.png' })
    expect(toast.warning).toHaveBeenCalledTimes(1)
    expect(String(vi.mocked(toast.warning).mock.calls[0][1]?.description)).toContain('row-level security')

    // Ein Zählfehler danach wird trotzdem gemeldet — eigene Marke.
    const z = doppel(() => ({ data: null, error: { message: 'Zeitüberschreitung' } }))
    await dateiFreigeben(z.zugang, ORT)
    expect(toast.warning).toHaveBeenCalledTimes(2)
  })

  it('Speicher antwortet { data: [], error: null } und die Datei ist noch da → loeschfehler, gemeldet, Vorschau bleibt', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLeereLoeschantwort(true)
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('loeschfehler')
    expect(d.gelistet).toEqual([{ bucket: 'generated-images', ordner: 'u1/j1', search: '0.png' }])
    expect(d.gezaehlt).toHaveLength(1)
    expect(toast.warning).toHaveBeenCalledTimes(1)
  })

  it('Speicher antwortet { data: [], error: null } und die Datei war schon weg → erledigt, keine Meldung', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLeereLoeschantwort(false)
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('geloescht')
    expect(toast.warning).not.toHaveBeenCalled()
  })

  it('leere Löschantwort und das Nachsehen scheitert → loeschfehler statt Schweigen', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    d.setzeLeereLoeschantwort(true)
    d.setzeListFehler({ message: 'Zeitüberschreitung' })
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('loeschfehler')
    expect(e.status === 'loeschfehler' && e.fehler).toContain('Zeitüberschreitung')
  })

  /*
    GEMESSEN AM 15.09.2026 in der echten Datenbank (Transaktion mit Rollback):
     · T8 — `revoke select on prompts from authenticated` bricht die Zählung ab,
       aber nicht mit der eigenen Meldung „Kernstelle … nicht sichtbar", sondern
       mit `permission denied for table prompts`;
     · T9 — ein Aufruf mit `anon` endet in
       `permission denied for function datei_verweise`.
    Beides darf NICHT als „Funktion fehlt" erscheinen: Die Funktion ist da, es
    fehlt ein Recht. Postgres meldet dafür den Code 42501.
  */
  it('gemessener Rechtefehler auf einer Kerntabelle (T8) zeigt den Grund', async () => {
    const d = doppel(() => ({ data: null, error: { code: '42501', message: 'permission denied for table prompts' } }))
    const e = await dateiFreigeben(d.zugang, ORT)
    expect(e.status).toBe('zaehlfehler')
    expect(d.geloescht).toEqual([])
    const beschreibung = String(vi.mocked(toast.warning).mock.calls[0][1]?.description)
    expect(beschreibung).toContain('Grund: 42501: permission denied for table prompts')
    expect(beschreibung).not.toContain('Datenbankfunktion zum Zählen fehlt')
  })

  it('gemessener Aufruf ohne Anmeldung (T9) zeigt den Grund, obwohl der Funktionsname darin steht', () => {
    const t = zaehlfehlerText('42501: permission denied for function datei_verweise')
    expect(t.beschreibung).toContain('Grund: 42501: permission denied for function datei_verweise')
    expect(t.beschreibung).not.toContain('Datenbankfunktion zum Zählen fehlt')
  })

  it('PGRST202 steht nur im Code, nicht im Text — trotzdem „Funktion fehlt"', async () => {
    const d = doppel(() => ({ data: null, error: { code: 'PGRST202', message: 'Not found in the schema cache' } }))
    await dateiFreigeben(d.zugang, ORT)
    expect(String(vi.mocked(toast.warning).mock.calls[0][1]?.description))
      .toContain('Die Datenbankfunktion zum Zählen fehlt')
  })

  it('eine Vorschaudatei selbst als Eingabe: weder gezählt noch gelöscht, kein Alarm', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    const ort = { bucket: 'generated-images', pfad: 'vorschau/u1/j1/0.png.jpg' }
    const e = await dateiFreigeben(d.zugang, ort)
    expect(e).toEqual({ status: 'bleibt-fuer-arbeiter', ort })
    expect(d.gezaehlt).toEqual([])
    expect(d.geloescht).toEqual([])
    expect(toast.warning).not.toHaveBeenCalled()
  })
})

describe('dateienFreigeben', () => {
  it('dieselbe Datei als Adresse und als Paar wird nur einmal bearbeitet', async () => {
    const d = doppel(() => ({ data: 0, error: null }))
    const e = await dateienFreigeben(d.zugang, [
      `${OEFFENTLICH}/generated-images/u1/j1/0.png?v=1`,
      { bucket: 'generated-images', pfad: 'u1/j1/0.png' },
      null,
    ], BASIS)
    expect(e).toHaveLength(1)
    // Einmal die Datei — nicht zweimal dieselbe. Die Vorschau fasst der Browser nicht an.
    expect(d.geloescht.flatMap(x => x.pfade)).toEqual(['u1/j1/0.png'])
  })

  it('Auftrag mit Quelle: Ergebnis frei, Quelle noch verwendet → nur das Ergebnis geht', async () => {
    const d = doppel(p => ({ data: p === 'u1/quelle/0.png' ? 1 : 0, error: null }))
    const e = await dateienFreigeben(d.zugang, [
      { bucket: 'generated-images', pfad: 'u1/j2/0.png' },
      { bucket: 'generated-images', pfad: 'u1/quelle/0.png' },
    ])
    expect(e.map(x => x.status)).toEqual(['geloescht', 'noch-verwendet'])
    expect(d.geloescht.flatMap(x => x.pfade)).toEqual(['u1/j2/0.png'])
  })
})
