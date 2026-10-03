'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Vorschaubild } from '@/components/vorschaubild'
import { useCharacters } from '@/hooks/use-characters'
import { useOutfits } from '@/hooks/use-outfits'
import { useImageJobs, ergebnisUrl } from '@/hooks/use-image-jobs'
import { useKoerperPresets } from '@/hooks/use-koerper-presets'
import { createClient } from '@/lib/supabase'
import { loadRefImages, type RefImage } from '@/lib/reference-images'
import { MODELLE_MIT_REFERENZ, STATUS_TEXT, istLokal, type ModellId } from '@/lib/image-generation'
import { OUTFIT_KATEGORIE_LABELS } from '@/lib/outfit-kategorien'
import { referenzenSichern, sicherungsMeldung } from '@/lib/referenzen-sichern'
import type { KoerperAuswahl } from '@/lib/referenzkette'
import {
  FORMATE, FORMAT_REIHE, VARIANTE_NAME, baueAuftraege, bilderText, fehlendes,
  outfitQuelle, personQuellen, sortiereFormate, type FormatId, type PersonenbildEingabe,
} from '@/lib/personenbild'
import { ablageMitFach, type VariantenClient } from '@/lib/ablage-variante'
import { KARTE_BILD, gesetzteRegionen, modusVon, reiheFuer, type KartenModus, type Schluessel } from '@/lib/koerper-regionen'
import { ImageLightbox } from '@/components/image-lightbox'
import { PersonMerkmale } from '@/components/characters/person-merkmale'
import { usePersonMerkmale } from '@/hooks/use-person-merkmale'
import { KOERPER_PRESETS } from '@/lib/koerper-presets'
import { bereinigeMerkmale, unterscheidetSich, type NutzerPreset } from '@/lib/koerper-nutzer-presets'
import { Koerperkarte, Regionsliste, Stufenfeld, koerperBildName } from '@/components/personenbilder/koerperkarte'
import { KoerperPresetsSpalte } from '@/components/personenbilder/koerper-presets-spalte'
import { Doppellinie, Passkreuz, Perforation } from '@/components/personenbilder/druckgrafik'
import { cn } from '@/lib/utils'

import '../scene-builder/papier.css'
import './personenbilder.css'

/**
 * Personenbilder (PROJ-92) — Person + Körper + Outfit → Referenzbilder.
 *
 * Aufbau nach Richtung A des Entwurfs (Mark, 29.09.2026): vier Felder oben
 * (01 PER · 02 KÖR · 03 OUT · 04 FMT), darunter Auswahl · Vorschau · Auftrag.
 * Im Reiter „Körper" die Körperkarte aus Richtung B; links davon die eigenen
 * Presets.
 *
 * JEDE ERZEUGUNG IST BEZAHLT, und der Klick auf den Knopf ist die Freigabe.
 * Deshalb steht die Zahl der Bilder VOR dem Klick auf dem Knopf, und nichts
 * startet von selbst.
 */

type Reiter = 'per' | 'koe' | 'out' | 'fmt'

const REITER: { key: Reiter; code: string; label: string }[] = [
  { key: 'per', code: '01 — PER', label: 'Person' },
  { key: 'koe', code: '02 — KÖR', label: 'Körper' },
  { key: 'out', code: '03 — OUT', label: 'Outfit' },
  { key: 'fmt', code: '04 — FMT', label: 'Format' },
]

function kleinschreibung(s: string) { return s.toLowerCase() }

/**
 * Die drei 2.5-Modelle über den Proxy — `gpt-image-2` bleibt gesperrt (Marks
 * Regel vom 10.09.2026) — und dahinter die lokalen Wege auf dem neuen PC (Qwen,
 * FLUX klein). SDXL+InstantID fehlt mit Absicht: Es nimmt genau ein Bild, die
 * Ketten hier schicken mehrere.
 */
const ERZEUGEN_MODELLE = MODELLE_MIT_REFERENZ.filter(
  m => m.id.startsWith('gpt-image-2.5') || (istLokal(m.id) && m.id !== 'lokal:sdxl_instantid'),
)

export default function PersonenbilderPage() {
  const { characters, loading: personenLaden } = useCharacters()
  const { outfits, loading: outfitsLaden } = useOutfits()
  const { jobs, anlegen } = useImageJobs(true)
  const nutzerPresets = useKoerperPresets()

  const [reiter, setReiter] = useState<Reiter>('per')
  const [personId, setPersonId] = useState<string | null>(null)
  const [outfitId, setOutfitId] = useState<string | null>(null)
  const [koerper, setKoerper] = useState<KoerperAuswahl>({})
  const [koerperBild, setKoerperBild] = useState<string | null>(null)
  const [aktiveRegion, setAktiveRegion] = useState<Schluessel>('becken')
  const [grossIdx, setGrossIdx] = useState<number | null>(null)
  const [kartenModus, setKartenModus] = useState<KartenModus>('form')
  const [presetId, setPresetId] = useState<string | null>(null)
  const [formate, setFormate] = useState<FormatId[]>(['sheet'])
  const [modell, setModell] = useState<ModellId>(ERZEUGEN_MODELLE[0].id as ModellId)
  const [sucheP, setSucheP] = useState('')
  const [sucheO, setSucheO] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [laeufe, setLaeufe] = useState<string[]>([])
  const sperre = useRef(false)

  const person = characters.find(c => c.id === personId) ?? null
  const personMerkmale = usePersonMerkmale(personId, person?.metadata)
  const outfit = outfits.find(o => o.id === outfitId) ?? null

  // ── Bilder der Auswahl nachladen ────────────────────────────────────────
  const [personBilder, setPersonBilder] = useState<RefImage[]>([])
  const [personBilderLaden, setPersonBilderLaden] = useState(false)
  // Ein Ladefehler darf nicht wie "keine Bilder" aussehen: sonst ginge das
  // bezahlte Bild mit dem Titelbild los, und die Seite behauptete, es gebe nur das.
  const [personBilderFehler, setPersonBilderFehler] = useState(false)
  useEffect(() => {
    if (!personId) { setPersonBilder([]); setPersonBilderFehler(false); return }
    let abgebrochen = false
    setPersonBilderLaden(true)
    setPersonBilderFehler(false)
    loadRefImages('character_variants', 'character_id', personId)
      .then(b => { if (!abgebrochen) setPersonBilder(b) })
      .catch(() => { if (!abgebrochen) { setPersonBilder([]); setPersonBilderFehler(true) } })
      .finally(() => { if (!abgebrochen) setPersonBilderLaden(false) })
    return () => { abgebrochen = true }
  }, [personId])

  const [outfitBilder, setOutfitBilder] = useState<RefImage[]>([])
  const [outfitBilderLaden, setOutfitBilderLaden] = useState(false)
  const [outfitBilderFehler, setOutfitBilderFehler] = useState(false)
  useEffect(() => {
    if (!outfitId) { setOutfitBilder([]); setOutfitBilderFehler(false); return }
    let abgebrochen = false
    setOutfitBilderLaden(true)
    setOutfitBilderFehler(false)
    loadRefImages('outfit_variants', 'outfit_id', outfitId)
      .then(b => { if (!abgebrochen) setOutfitBilder(b) })
      .catch(() => { if (!abgebrochen) { setOutfitBilder([]); setOutfitBilderFehler(true) } })
      .finally(() => { if (!abgebrochen) setOutfitBilderLaden(false) })
    return () => { abgebrochen = true }
  }, [outfitId])

  const quellen = useMemo(
    () => personQuellen(personBilder, person?.cover_image_url ?? null),
    [personBilder, person?.cover_image_url],
  )
  const outfitBild = useMemo(
    () => outfitQuelle(outfitBilder, outfit?.cover_image_url ?? null),
    [outfitBilder, outfit?.cover_image_url],
  )

  // ── Eingabe und Vorschau des Prompts ────────────────────────────────────
  const eingabe: PersonenbildEingabe | null = person && outfit ? {
    personId: person.id, personName: person.name, personQuellen: quellen,
    outfitId: outfit.id, outfitName: outfit.name, outfitBild,
    koerperBild, koerperAuswahl: koerper, formate, modell, durchlaufId: 'vorschau',
    geschlecht: personMerkmale.geschlecht, hautzeichen: personMerkmale.hautzeichen,
  } : null
  const fehlt = [
    ...(eingabe
      ? fehlendes(eingabe)
      : [!person ? 'Person' : null, !outfit ? 'Outfit' : null, sortiereFormate(formate).length === 0 ? 'Format' : null]
          .filter((x): x is string => x !== null)),
    ...(personBilderFehler ? ['Bilder der Person (Laden fehlgeschlagen)'] : []),
    ...(outfitBilderFehler ? ['Bilder des Outfits (Laden fehlgeschlagen)'] : []),
  ]
  const gewaehlteFormate = sortiereFormate(formate)
  const vorschauPrompt = eingabe && fehlt.length === 0 ? baueAuftraege(eingabe)[0]?.prompt ?? '' : ''
  const ladenNoch = personBilderLaden || outfitBilderLaden || (!!person && (personMerkmale.laedt || personMerkmale.fehler))

  // ── Handlungen ──────────────────────────────────────────────────────────
  function setzeWert(k: Schluessel, wert: string | null) {
    setKoerper(alt => {
      const neu = { ...alt } as Record<string, string>
      if (wert === null) delete neu[k]
      else neu[k] = wert
      return neu as KoerperAuswahl
    })
    setAktiveRegion(k)
    // Das Blender-Bild zeigt EINE Stufe EINER Region. Wird diese Region anders
    // gesetzt, widerspraeche das Bild der Textzeile (Critic, 29.09.2026).
    const bildPreset = KOERPER_PRESETS.find(p => p.bildUrl === koerperBild)
    if (bildPreset) {
      const bildWert = (bildPreset.merkmale as Record<string, string | undefined>)[k]
      if (bildWert !== undefined && bildWert !== wert) setKoerperBild(null)
    }
  }
  function setzeWertMitBild(k: Schluessel, wert: string, bildUrl: string) {
    setzeWert(k, wert)
    setKoerperBild(bildUrl)
  }
  function presetWaehlen(p: NutzerPreset) {
    setKoerper(bereinigeMerkmale(p.merkmale))
    setKoerperBild(p.koerperBild)
    setPresetId(p.id)
  }
  function koerperLeeren() {
    setKoerper({}); setKoerperBild(null); setPresetId(null)
  }
  function formatUmschalten(id: FormatId) {
    setFormate(alt => alt.includes(id) ? alt.filter(f => f !== id) : [...alt, id])
  }
  function allesLeeren() {
    setPersonId(null); setOutfitId(null); koerperLeeren(); setFormate(['sheet']); setReiter('per')
  }

  async function erzeugen() {
    if (!eingabe || !person || fehlt.length > 0 || ladenNoch || sperre.current) return
    sperre.current = true
    setLaeuft(true)
    try {
      const durchlaufId = crypto.randomUUID()
      const auftraege = baueAuftraege({ ...eingabe, durchlaufId })

      // Das Fach beim Charakter — erst jetzt, wo feststeht, dass erzeugt wird.
      const ziel = await ablageMitFach(
        createClient() as unknown as VariantenClient,
        { baustein: 'charaktere', parentId: person.id, parentName: person.name, variantId: null, variantName: VARIANTE_NAME },
      )
      if (!ziel) toast.error('Der Ordner beim Charakter konnte nicht angelegt werden — die Bilder bleiben in der Warteschlange.')

      // Fremde Referenzbilder vorher holen (der Arbeiter lehnt sie sonst ab).
      // Die Liste ist für alle Formate dieselbe, also einmal.
      const sicherung = await referenzenSichern(auftraege[0].referenzUrls)
      const meldung = sicherungsMeldung(sicherung)
      if (sicherung.gescheitert.length > 0) {
        // Ein Auftrag mit einem Bild, das der Arbeiter ablehnt, scheitert sicher.
        toast.error(meldung ?? 'Ein Referenzbild ließ sich nicht holen — es wurde nichts eingereiht.')
        return
      }
      if (meldung) toast.info(meldung)

      let eingereiht = 0
      for (const a of auftraege) {
        const job = await anlegen({
          prompt: a.prompt, model: a.model, size: a.size, aspect_ratio: a.aspect_ratio,
          variants: 1,
          reference_urls: sicherung.urls, reference_roles: a.rollen,
          scene_meta: { ...a.scene_meta, ...(ziel ? { ablage: ziel } : {}) },
        })
        if (!job) break
        eingereiht++
      }
      if (eingereiht > 0) setLaeufe(alt => [durchlaufId, ...alt])
      if (eingereiht > 0 && eingereiht < auftraege.length) {
        // Die Auswahl schrumpft auf den Rest: Ein zweiter Klick soll nicht alles noch einmal bezahlen.
        const rest = auftraege.slice(eingereiht).map(a => a.format)
        setFormate(rest)
        toast.error(`${eingereiht} von ${auftraege.length} eingereiht — es fehlen noch: ${rest.map(f => FORMATE.find(x => x.id === f)!.label).join(', ')}.`)
      } else if (eingereiht === auftraege.length) {
        toast.success(eingereiht === 1 ? 'Auftrag eingereiht' : `${eingereiht} Aufträge eingereiht`, {
          description: 'Der Arbeiter auf dem PC holt sie ab.',
        })
      } else {
        toast.error('Der Auftrag konnte nicht eingereiht werden.')
      }
    } finally {
      sperre.current = false
      setLaeuft(false)
    }
  }

  // ── Listen ──────────────────────────────────────────────────────────────
  const personenListe = useMemo(() => {
    const s = kleinschreibung(sucheP.trim())
    return s ? characters.filter(c => kleinschreibung(c.name).includes(s)) : characters
  }, [characters, sucheP])
  const outfitListe = useMemo(() => {
    const s = kleinschreibung(sucheO.trim())
    return s ? outfits.filter(o => kleinschreibung(o.name).includes(s)) : outfits
  }, [outfits, sucheO])

  const ergebnisse = useMemo(
    () => jobs.filter(j => laeufe.includes(String((j.scene_meta as Record<string, unknown> | null)?.personenbild_id ?? ''))),
    [jobs, laeufe],
  )
  const fertige = useMemo(
    () => ergebnisse.filter(j => j.status === 'done' && j.result_paths[0]),
    [ergebnisse],
  )

  const regionen = gesetzteRegionen(koerper, personMerkmale.geschlecht)
  const formRegionen = regionen.filter(r => modusVon(r.schluessel) === 'form')
  const muskelRegionen = regionen.filter(r => modusVon(r.schluessel) === 'muskeln')
  const quellenText =
    quellen.length === 0 ? null
    : quellen[0].art === 'sheet' ? 'Referenzsheet'
    : quellen[0].art === 'titel' ? 'Nur das Titelbild'
    : 'Kopf- und Körperblatt'

  const felder: Record<Reiter, { wert: string; bild?: string | null; gewaehlt: boolean }> = {
    per: { wert: person?.name ?? 'Wählen', gewaehlt: !!person },
    koe: {
      wert: regionen.length > 0 ? `${regionen.length} ${regionen.length === 1 ? 'Region' : 'Regionen'}` : koerperBild ? 'Körperbild' : 'Laut Bild',
      gewaehlt: regionen.length > 0 || !!koerperBild,
    },
    out: { wert: outfit?.name ?? 'Wählen', bild: outfit?.cover_image_url ?? null, gewaehlt: !!outfit },
    fmt: {
      wert: gewaehlteFormate.length === 0 ? 'Wählen'
        : gewaehlteFormate.length === FORMATE.length ? 'Alle drei'
        : gewaehlteFormate.map(f => FORMATE.find(x => x.id === f)!.label).join(' · '),
      gewaehlt: gewaehlteFormate.length > 0,
    },
  }

  // ── Bausteine der Seite ─────────────────────────────────────────────────
  const auftragsspalte = (
    <div className="sb-mod pb-karte flex flex-col gap-4">
      <div className="pb-titelzeile" style={{ marginBottom: 0 }}><h2>Auftrag</h2></div>
      <div className="sb-dbl" aria-hidden="true" />

      <div className="pb-chips">
        <span className="pb-chip">Person <b>{person?.name ?? '—'}</b></span>
        <span className="pb-chip">Outfit <b>{outfit?.name ?? '—'}</b></span>
        {regionen.map(r => <span key={r.schluessel} className="pb-chip">{r.label} <b>{r.stufe}</b></span>)}
        {koerperBild && (
          <span className="pb-chip">
            Körperbild <b>{koerperBildName(koerperBild)}</b>
            <button type="button" aria-label="Körperbild entfernen" onClick={() => setKoerperBild(null)}>×</button>
          </span>
        )}
        {regionen.length === 0 && !koerperBild && <span className="pb-chip">Körper <b>laut Bild</b></span>}
      </div>

      <div>
        <label htmlFor="pb-modell" className="mb-1.5 block text-[15px] font-semibold">Modell</label>
        <select id="pb-modell" className="pb-suche" value={modell} onChange={e => setModell(e.target.value as ModellId)}>
          {ERZEUGEN_MODELLE.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {istLokal(modell) && (
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {ERZEUGEN_MODELLE.find(m => m.id === modell)?.note}. Rechnet auf dem neuen PC — der muss an sein.
          </p>
        )}
      </div>

      {vorschauPrompt && (
        <details>
          <summary className="cursor-pointer text-[15px] font-semibold">Prompt ansehen</summary>
          <pre className="pb-vorschau mt-2">{vorschauPrompt}</pre>
        </details>
      )}

      {fehlt.length > 0 && (
        <p className="pb-hinweis" role="status">Es fehlt: {fehlt.join(', ')}.</p>
      )}

      <button
        type="button" className="sb-taste pb-haupt"
        disabled={fehlt.length > 0 || laeuft || ladenNoch}
        onClick={() => void erzeugen()}
      >
        {laeuft ? 'Reiht ein …' : `${bilderText(gewaehlteFormate.length)} erzeugen`}
      </button>

      <div>
        <div className="sb-plate mb-2.5">Ergebnis</div>
        {ergebnisse.length === 0 ? (
          <div className="pb-ergebnisse">
            <div className="pb-bild sb-leer leer">noch keins</div>
          </div>
        ) : (
          <div className="pb-ergebnisse">
            {ergebnisse.map(j => {
              const meta = (j.scene_meta ?? {}) as Record<string, unknown>
              const fmt = FORMATE.find(f => f.id === meta.format)
              return (
                <div key={j.id} className="pb-ergebnis">
                  <div className="pb-bild">
                    {j.status === 'done' && j.result_paths[0]
                      ? (
                        <button type="button" className="pb-gross"
                          aria-label={`${String(meta.name ?? 'Bild')} vergrößern`}
                          onClick={() => setGrossIdx(fertige.findIndex(f => f.id === j.id))}>
                          <Vorschaubild src={ergebnisUrl(j.result_paths[0])} alt={String(meta.name ?? '')} gross />
                        </button>
                      )
                      : <span className="pb-hinweis">{STATUS_TEXT[j.status]}</span>}
                  </div>
                  <span className="pb-status" data-s={j.status}>{fmt?.label ?? 'Bild'} · {STATUS_TEXT[j.status]}</span>
                </div>
              )
            })}
          </div>
        )}
        <p className="pb-hinweis mt-2.5">Ablage: Charakter · {VARIANTE_NAME}</p>
        {grossIdx !== null && fertige[grossIdx] && (
          <ImageLightbox
            images={fertige.map(f => ({ url: ergebnisUrl(f.result_paths[0]), id: f.id }))}
            initialIndex={grossIdx}
            onClose={() => setGrossIdx(null)}
          />
        )}
      </div>
    </div>
  )

  const zutaten = (
    <div className="sb-mod pb-karte flex flex-col gap-4">
      <div className="pb-titelzeile" style={{ marginBottom: 0 }}><h2>Zutaten</h2></div>
      <div className="sb-dbl" aria-hidden="true" />
      <div className="pb-zutaten">
        <div className="pb-zutat">
          <span className="sb-plate">Person</span>
          <div className={cn('pb-bild', !person?.cover_image_url && 'sb-leer leer')}>
            {person?.cover_image_url ? <Vorschaubild src={person.cover_image_url} alt={person.name} gross /> : 'Noch keine Person'}
          </div>
          <span className="pb-name" style={{ fontWeight: 700 }}>{person?.name ?? ''}</span>
          {quellenText && (
            <span className="pb-klein">{personBilderLaden ? 'Lädt …' : personBilderFehler ? 'Bilder ließen sich nicht laden' : quellenText}</span>
          )}
        </div>
        <div className="pb-zutat">
          <span className="sb-plate">Outfit</span>
          <div className={cn('pb-bild', !outfitBild && 'sb-leer leer')}>
            {outfitBild ? <Vorschaubild src={outfitBild} alt={outfit?.name ?? ''} gross /> : 'Noch kein Outfit'}
          </div>
          <span className="pb-name" style={{ fontWeight: 700 }}>{outfit?.name ?? ''}</span>
        </div>
        <div className="pb-zutat">
          <span className="sb-plate">Körper</span>
          <div className="pb-bild dunkel">
            {koerperBild
              ? <Vorschaubild src={koerperBild} alt="" gross />
              // eslint-disable-next-line @next/next/no-img-element
              : <img src={KARTE_BILD} alt="Grundfigur" style={{ objectFit: 'contain' }} />}
          </div>
          <span className="pb-klein">{koerperBild ? koerperBildName(koerperBild) : 'Laut Referenzbild'}</span>
        </div>
      </div>
      {quellen[0]?.art === 'titel' && person && !personBilderLaden && !personBilderFehler && (
        <p className="pb-hinweis" role="status">
          Für {person.name} gibt es nur das Titelbild. Mit einem Referenzsheet wird die Person genauer.
        </p>
      )}
    </div>
  )

  return (
    <div className="sb-papier pb flex h-svh min-w-0 overflow-hidden">
      <div className="sb-blatt flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative flex h-[64px] shrink-0 items-center gap-4 border-b border-[var(--sb-rule)] px-6">
          <SidebarTrigger />
          <Passkreuz />
          <h1 className="text-[22px] font-bold uppercase tracking-[0.2em]">Personenbilder</h1>
          <span className="hidden text-[14px] tracking-[0.14em] text-[var(--sb-ink3)] md:inline">
            PERSON · KÖRPER · OUTFIT
          </span>
          <button type="button" className="sb-taste ml-auto" onClick={allesLeeren}>Leeren</button>
          <Passkreuz />
          <div className="pointer-events-none absolute inset-x-0 bottom-[3px] h-px bg-[var(--sb-rule2)]" aria-hidden="true" />
        </header>

        <div className="relative flex-1 overflow-hidden">
          <div className="absolute inset-0 ohne-rollbalken overflow-y-auto overflow-x-hidden px-8 py-5">

            {/* ══ Der Bausteinbogen ══ */}
            <div className="sb-strip px-3 pb-2 pt-3">
              <div className="pb-felder" role="tablist" aria-label="Bausteine">
                {REITER.map(r => {
                  const f = felder[r.key]
                  return (
                    <button
                      key={r.key} type="button" role="tab" className="pb-feld"
                      aria-selected={reiter === r.key}
                      data-an={reiter === r.key ? 'ja' : undefined}
                      onClick={() => setReiter(r.key)}
                    >
                      <span className="pb-nr">
                        {r.code}
                        {f.gewaehlt && <span className="ml-auto" style={{ color: 'var(--pb-wahl)' }}>GEWÄHLT</span>}
                      </span>
                      <span className="pb-wert">
                        {f.bild && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.bild} alt="" />
                        )}
                        <span>{f.wert}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              <Perforation />
            </div>

            <Doppellinie />

            {/* ══ Reiter: Körper ══ */}
            {reiter === 'koe' && (
              <div className="pb-koerper">
                <div className="pb-links">
                {person ? (
                  <div className="sb-mod pb-karte mb-4">
                    <div className="pb-titelzeile"><h2>Merkmale von {person.name}</h2></div>
                    <PersonMerkmale
                      geschlecht={personMerkmale.geschlecht} hautzeichen={personMerkmale.hautzeichen}
                      onGeschlecht={personMerkmale.speichereGeschlecht} onHautzeichen={personMerkmale.speichereHautzeichen}
                      gesperrt={personMerkmale.gesperrt} fehler={personMerkmale.fehler}
                    />
                  </div>
                ) : (
                  <p className="pb-hinweis mb-4">Wähle im Reiter „Person“ eine Person, dann kannst du hier Geschlecht, Tattoos und Narben eintragen.</p>
                )}
                <div className="pb-karte-drei">
                  <div className="sb-mod pb-karte">
                    <KoerperPresetsSpalte
                      presets={nutzerPresets.presets}
                      laedt={nutzerPresets.laedt}
                      fehler={nutzerPresets.fehler}
                      auswahl={koerper}
                      koerperBild={koerperBild}
                      gewaehlt={presetId}
                      geaendert={presetId !== null && (() => { const p = nutzerPresets.presets.find(x => x.id === presetId); return !!p && unterscheidetSich(p, koerper, koerperBild) })()}
                      onWaehlen={presetWaehlen}
                      onAnlegen={async name => {
                        const neu = await nutzerPresets.anlegen(name, koerper, koerperBild)
                        if (neu) { setPresetId(neu.id); toast.success(`Preset „${neu.name}" gespeichert`) }
                        return !!neu
                      }}
                      onUeberschreiben={async id => {
                        const ok = await nutzerPresets.ueberschreiben(id, koerper, koerperBild)
                        if (ok) toast.success('Preset überschrieben')
                        return ok
                      }}
                      onUmbenennen={nutzerPresets.umbenennen}
                      onLoeschen={async id => {
                        const ok = await nutzerPresets.loeschen(id)
                        if (ok && presetId === id) setPresetId(null)
                        return ok
                      }}
                      onLeeren={koerperLeeren}
                    />
                  </div>

                  <div className="sb-mod pb-karte flex flex-col gap-4">
                    <div className="pb-titelzeile" style={{ marginBottom: 0 }}>
                      <h2>Körperkarte</h2>
                      <span className="pb-zahl ml-auto">
                        {kartenModus === 'form' ? `${formRegionen.length} von 12` : `${muskelRegionen.length} von 9`} gesetzt
                      </span>
                    </div>
                    <div className="pb-stufen" role="group" aria-label="Karte wählen">
                      {([['form', 'Körperform'], ['muskeln', 'Muskeln']] as [KartenModus, string][]).map(([m, l]) => (
                        <button key={m} type="button" className="sb-taste"
                          data-an={kartenModus === m ? 'ja' : undefined} aria-pressed={kartenModus === m}
                          onClick={() => { setKartenModus(m); if (modusVon(aktiveRegion) !== m) setAktiveRegion(reiheFuer(m)[0]) }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <div className="sb-dbl" aria-hidden="true" />
                    <Koerperkarte auswahl={koerper} aktiv={aktiveRegion} onAktiv={setAktiveRegion} modus={kartenModus} geschlecht={personMerkmale.geschlecht} />
                    <Regionsliste auswahl={koerper} aktiv={aktiveRegion} onAktiv={setAktiveRegion} modus={kartenModus} geschlecht={personMerkmale.geschlecht} />
                  </div>

                  <div className="sb-mod pb-karte">
                    <Stufenfeld
                      region={aktiveRegion} auswahl={koerper} koerperBild={koerperBild} geschlecht={personMerkmale.geschlecht}
                      onWert={setzeWert} onWertMitBild={setzeWertMitBild}
                    />
                  </div>
                </div>
                </div>
                {auftragsspalte}
              </div>
            )}

            {/* ══ Reiter: Person, Outfit, Format ══ */}
            {reiter !== 'koe' && (
              <div className="pb-drei">
                <div className="sb-mod pb-karte">
                  {reiter === 'per' && (
                    <>
                      <div className="pb-titelzeile">
                        <h2>Person</h2><span className="pb-zahl ml-auto">{personenListe.length}</span>
                      </div>
                      <input className="pb-suche mb-4" type="search" placeholder="Person suchen …" aria-label="Person suchen"
                        value={sucheP} onChange={e => setSucheP(e.target.value)} />
                      {personenLaden ? <p className="pb-hinweis">Lädt …</p>
                        : personenListe.length === 0 ? <p className="pb-hinweis">Keine Person gefunden.</p>
                        : (
                          <div className="pb-raster-personen">
                            {personenListe.map(c => (
                              <button key={c.id} type="button" className="pb-kachel"
                                data-an={personId === c.id ? 'ja' : undefined}
                                aria-pressed={personId === c.id}
                                onClick={() => { setPersonId(c.id) }}>
                                <div className={cn('pb-bild', !c.cover_image_url && 'sb-leer leer')}>
                                  {c.cover_image_url ? <Vorschaubild src={c.cover_image_url} alt="" /> : 'Kein Titelbild'}
                                </div>
                                <span className="pb-name">{c.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                    </>
                  )}

                  {reiter === 'out' && (
                    <>
                      <div className="pb-titelzeile">
                        <h2>Outfit</h2><span className="pb-zahl ml-auto">{outfitListe.length}</span>
                      </div>
                      <input className="pb-suche mb-4" type="search" placeholder="Outfit suchen …" aria-label="Outfit suchen"
                        value={sucheO} onChange={e => setSucheO(e.target.value)} />
                      {outfitsLaden ? <p className="pb-hinweis">Lädt …</p>
                        : outfitListe.length === 0 ? <p className="pb-hinweis">Kein Outfit gefunden.</p>
                        : (
                          <div className="pb-raster-outfits">
                            {outfitListe.map(o => (
                              <button key={o.id} type="button" className="pb-kachel"
                                data-an={outfitId === o.id ? 'ja' : undefined}
                                aria-pressed={outfitId === o.id}
                                onClick={() => setOutfitId(o.id)}>
                                <div className={cn('pb-bild', !o.cover_image_url && 'sb-leer leer')}>
                                  {o.cover_image_url ? <Vorschaubild src={o.cover_image_url} alt="" /> : 'Kein Bild'}
                                </div>
                                <span className="pb-name">{o.name}</span>
                                {OUTFIT_KATEGORIE_LABELS[o.category] && (
                                  <span className="pb-klein">{OUTFIT_KATEGORIE_LABELS[o.category]}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                    </>
                  )}

                  {reiter === 'fmt' && (
                    <>
                      <div className="pb-titelzeile">
                        <h2>Format</h2>
                        <div className="ml-auto flex gap-2">
                          <button type="button" className="sb-taste klein"
                            data-an={gewaehlteFormate.length === FORMATE.length ? 'ja' : undefined}
                            onClick={() => setFormate([...FORMAT_REIHE])}>Alle drei</button>
                          <button type="button" className="sb-taste klein" onClick={() => setFormate([])}
                            disabled={gewaehlteFormate.length === 0}>Keins</button>
                        </div>
                      </div>
                      <div className="pb-raster-formate">
                        {FORMATE.map(f => (
                          <button key={f.id} type="button" className="pb-kachel"
                            data-an={formate.includes(f.id) ? 'ja' : undefined}
                            aria-pressed={formate.includes(f.id)}
                            onClick={() => formatUmschalten(f.id)}>
                            <span className="pb-name" style={{ fontSize: 20 }}>{f.label}</span>
                            <span className="pb-klein" style={{ fontSize: 15 }}>{f.beschreibung}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {zutaten}
                {auftragsspalte}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
