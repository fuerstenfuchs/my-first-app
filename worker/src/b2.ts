/**
 * Backblaze B2 — das Archiv für die Originale neuer Ergebnisse.
 *
 * WARUM: Seit dem 15.09.2026 liegen in Supabase nur noch WebP-Fassungen
 * ≤ 2048 px (329 MB statt voll, Limit 1 GB). Die Originale gehören nach
 * Backblaze. Dieser Baustein legt sie dort ab und holt sie zum Vergrößern
 * wieder heraus.
 *
 * ÜBERNOMMEN AUS DEM UMZUGSSKRIPT (`tresor-schritt3.mjs`), weil dort jede
 * dieser Regeln einmal gekostet hat:
 *  · Nach JEDEM Fehler eine neue Upload-Adresse holen — B2 verlangt das.
 *  · B2 bestätigt SHA-1 und Länge; beides wird geprüft. Stimmt eines nicht,
 *    gilt das Original als NICHT gesichert, und es wird kein zweites Mal
 *    versucht (ein falsches Byte ist kein Netzaussetzer).
 *  · Hat das Bucket Lebenszyklusregeln, wird gar nicht erst angefangen — eine
 *    solche Regel könnte ein gesichertes Original später still löschen.
 *
 * DIE FASSUNG HÄNGT AM ORIGINAL (Critic B1, 15.09.2026): Jedes Original trägt
 * als B2-Dateiinfo `webp_sha256` die Prüfsumme der WebP-Fassung, die dazu in
 * Supabase liegt. Nur wenn beide zusammenpassen, wird das Original zum
 * Vergrößern benutzt (`quelleHolen` in `supabase.ts`).
 *
 * Gibt nie Schlüsselwerte aus. `fetch` und das Warten lassen sich für Tests
 * austauschen; im Betrieb gilt `b2AusKonfiguration()`.
 */

import { createHash } from 'node:crypto'
import { config, b2Einrichtung } from './config.ts'

/** Wo die Originale des Arbeiters liegen. Marks Vorgabe vom 15.09.2026. */
export const B2_PRAEFIX = 'tresor-supabase/worker'

/** Name des Originals zu einem Ergebnis `<user>/<job>/<index>`. */
export function originalName(userId: string, jobId: string, index: number, endung: string): string {
  return `${B2_PRAEFIX}/${userId}/${jobId}/${index}.${endung}`
}

/**
 * Das Präfix, unter dem das Original zu einem Supabase-Pfad liegt — ohne
 * Endung, weil die im Archiv eine andere ist (`0.png` dort, `0.webp` hier).
 * `null`, wenn der Pfad nicht wie ein Ergebnis des Arbeiters aussieht.
 */
export function originalPraefix(pfad: string): string | null {
  const m = /^([^/]+)\/([^/]+)\/(\d+)\.[a-z0-9]{2,5}$/i.exec(pfad)
  return m ? `${B2_PRAEFIX}/${m[1]}/${m[2]}/${m[3]}.` : null
}

/*
  KEINE PARAMETER-EIGENSCHAFT (`constructor(msg, readonly status = 0)`).
  Am 15.09.2026 so gebaut: `tsc` war grün, aber Node startet den Arbeiter im
  Modus „Typen nur entfernen" und bricht bei dieser Schreibweise mit
  ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX ab — schon beim Laden, noch vor jeder
  Prüfung. Weil `index.ts` diese Datei einbindet, wäre der Arbeiter gar nicht
  mehr angelaufen, auch ohne Backblaze-Schlüssel. Gefunden hat es erst
  `npm test`, nicht die Typprüfung.
*/
export class B2Fehler extends Error {
  status: number
  /** Der Fehlercode von B2, etwa `download_cap_exceeded`. */
  code: string
  constructor(message: string, status = 0, code = '') {
    super(message)
    this.name = 'B2Fehler'
    this.status = status
    this.code = code
  }
}

/** Ein gefundenes Original samt seiner Dateiinfo. */
export type B2Original = { name: string; info: Record<string, string> }

export type B2Ablage = {
  /** Meldet an und prüft das Bucket. Wirft mit einem lesbaren Satz. */
  anmelden: () => Promise<void>
  /**
   * Lädt hoch und prüft die Bestätigung von B2. Wirft, wenn nicht gesichert.
   * `info` wird als B2-Dateiinfo mitgespeichert; `signal` bricht ab.
   */
  hochladen: (
    name: string, daten: Uint8Array, typ: string,
    optionen?: { info?: Record<string, string>; signal?: AbortSignal },
  ) => Promise<{ fileId: string; sha1: string }>
  /** Das neueste hochgeladene Original unter diesem Präfix, oder `null`. */
  originalSuchen: (praefix: string) => Promise<B2Original | null>
  /** Lädt herunter und prüft SHA-1 und Länge, wo B2 sie mitliefert. */
  herunterladen: (name: string) => Promise<Buffer>
}

type Zugang = { keyId: string; appKey: string; bucket: string }
type Sitzung = { api: string; download: string; token: string; bucketId: string }

const sha1 = (daten: Uint8Array) => createHash('sha1').update(daten).digest('hex')
const kodiert = (name: string) => name.split('/').map(encodeURIComponent).join('/')

export function b2Verbindung(
  zugang: Zugang,
  abruf: typeof fetch = fetch,
  warten: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
): B2Ablage {
  let sitzung: Sitzung | null = null
  let upload: { uploadUrl: string; authorizationToken: string } | null = null

  async function jsonRuf(url: string, token: string, rumpf: unknown): Promise<Record<string, unknown>> {
    const name = url.split('/').pop()
    for (let versuch = 1; ; versuch++) {
      try {
        const r = await abruf(url, {
          method: 'POST',
          headers: { Authorization: token },
          body: JSON.stringify(rumpf),
          signal: AbortSignal.timeout(60_000),
        })
        const j = await r.json().catch(() => ({})) as Record<string, unknown>
        if (r.ok) return j
        // Abgelaufene Anmeldung (sie gilt 24 Stunden): beim nächsten Mal neu.
        if (r.status === 401) sitzung = null
        if (versuch >= 4 || ![408, 429, 500, 503].includes(r.status)) {
          const code = String(j.code ?? '')
          throw new B2Fehler(`B2 ${name}: HTTP ${r.status} ${code}`.trim(), r.status, code)
        }
      } catch (e) {
        if (e instanceof B2Fehler || versuch >= 4) throw e
      }
      await warten(2000 * versuch)
    }
  }

  async function anmelden(): Promise<Sitzung> {
    const a = await abruf('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
      headers: { Authorization: 'Basic ' + Buffer.from(`${zugang.keyId}:${zugang.appKey}`).toString('base64') },
      signal: AbortSignal.timeout(30_000),
    })
    if (!a.ok) {
      throw new B2Fehler(
        a.status === 401
          ? 'B2 lehnt die Anmeldung ab (HTTP 401) — B2_KEY_ID und B2_APP_KEY prüfen.'
          : `B2-Anmeldung: HTTP ${a.status}`,
        a.status,
      )
    }
    const auth = await a.json() as {
      accountId: string; authorizationToken: string
      apiInfo: { storageApi: { apiUrl: string; downloadUrl: string } }
    }
    const api = auth.apiInfo.storageApi.apiUrl
    const liste = await jsonRuf(`${api}/b2api/v3/b2_list_buckets`, auth.authorizationToken, {
      accountId: auth.accountId, bucketName: zugang.bucket,
    }) as { buckets?: { bucketId: string; lifecycleRules?: unknown[] }[] }
    const bucket = liste.buckets?.[0]
    if (!bucket) throw new B2Fehler(`B2-Bucket „${zugang.bucket}" nicht gefunden — B2_BUCKET prüfen.`)
    if ((bucket.lifecycleRules ?? []).length > 0) {
      throw new B2Fehler(
        'Das B2-Bucket hat Lebenszyklusregeln — sie könnten Originale später löschen. ' +
        'Erst mit Mark klären; bis dahin wird nichts nach Backblaze gelegt.',
      )
    }
    sitzung = { api, download: auth.apiInfo.storageApi.downloadUrl, token: auth.authorizationToken, bucketId: bucket.bucketId }
    upload = null
    return sitzung
  }

  const aktuelleSitzung = async () => sitzung ?? anmelden()

  return {
    async anmelden() { await anmelden() },

    async hochladen(name, daten, typ, optionen = {}) {
      const { info = {}, signal } = optionen
      const pruefsumme = sha1(daten)
      const infoKoepfe = Object.fromEntries(
        Object.entries(info).map(([k, v]) => [`X-Bz-Info-${k}`, encodeURIComponent(v)]),
      )
      for (let versuch = 1; ; versuch++) {
        // Abbruch durch den Bediener (zweimal Strg+C, Critic K3): sofort aufhören,
        // nicht als Netzfehler behandeln und nicht wiederholen.
        signal?.throwIfAborted()
        try {
          const s = await aktuelleSitzung()
          upload ??= await jsonRuf(`${s.api}/b2api/v3/b2_get_upload_url`, s.token, { bucketId: s.bucketId }) as
            { uploadUrl: string; authorizationToken: string }
          const frist = AbortSignal.timeout(300_000)
          const r = await abruf(upload.uploadUrl, {
            method: 'POST',
            headers: {
              Authorization: upload.authorizationToken,
              'X-Bz-File-Name': kodiert(name),
              'Content-Type': typ || 'application/octet-stream',
              'Content-Length': String(daten.length),
              'X-Bz-Content-Sha1': pruefsumme,
              ...infoKoepfe,
            },
            body: new Uint8Array(daten),
            signal: signal ? AbortSignal.any([frist, signal]) : frist,
          })
          const j = await r.json().catch(() => ({})) as { fileId?: string; contentSha1?: string; contentLength?: number; code?: string }
          if (r.ok) {
            if (j.contentSha1 !== pruefsumme || Number(j.contentLength) !== daten.length) {
              throw new B2Fehler(`B2 bestätigt andere Prüfsumme oder Länge für ${name} — nicht gesichert.`)
            }
            return { fileId: String(j.fileId ?? ''), sha1: pruefsumme }
          }
          if (r.status === 401) sitzung = null
          if (versuch >= 4) throw new B2Fehler(`B2-Upload ${name}: HTTP ${r.status} ${j.code ?? ''}`.trim(), r.status, j.code ?? '')
        } catch (e) {
          if (signal?.aborted) throw signal.reason ?? e
          if (versuch >= 4 || (e instanceof B2Fehler && e.message.includes('andere Prüfsumme'))) throw e
        }
        upload = null // B2 verlangt nach Fehlern eine neue Upload-Adresse
        await warten(2000 * versuch)
      }
    },

    async originalSuchen(praefix) {
      const s = await aktuelleSitzung()
      const j = await jsonRuf(`${s.api}/b2api/v3/b2_list_file_names`, s.token, {
        bucketId: s.bucketId, prefix: praefix, maxFileCount: 10,
      }) as { files?: { fileName: string; action?: string; uploadTimestamp?: number; fileInfo?: Record<string, string> }[] }
      const treffer = (j.files ?? [])
        .filter(f => f.fileName.startsWith(praefix) && (f.action ?? 'upload') === 'upload')
        .sort((a, b) => (b.uploadTimestamp ?? 0) - (a.uploadTimestamp ?? 0))[0]
      if (!treffer) return null
      const info = Object.fromEntries(
        Object.entries(treffer.fileInfo ?? {}).map(([k, v]) => [k, decodeURIComponent(String(v))]),
      )
      return { name: treffer.fileName, info }
    },

    async herunterladen(name) {
      for (let versuch = 1; versuch <= 2; versuch++) {
        const s = await aktuelleSitzung()
        const r = await abruf(`${s.download}/file/${encodeURIComponent(zugang.bucket)}/${kodiert(name)}`, {
          headers: { Authorization: s.token },
          signal: AbortSignal.timeout(300_000),
        })
        if (r.status === 401 && versuch === 1) { sitzung = null; continue }
        if (!r.ok) {
          // Den Code mitgeben: `download_cap_exceeded` (Tageslimit) soll als
          // solches erkennbar sein, nicht als nackte 403 (Critic S1).
          const j = await r.json().catch(() => ({})) as { code?: string }
          throw new B2Fehler(`B2-Download ${name}: HTTP ${r.status} ${j.code ?? ''}`.trim(), r.status, j.code ?? '')
        }
        const daten = Buffer.from(await r.arrayBuffer())
        const erwartet = r.headers.get('x-bz-content-sha1')
        // Bei großen, in Teilen hochgeladenen Dateien steht dort „none".
        if (erwartet && erwartet !== 'none' && erwartet !== sha1(daten)) {
          throw new B2Fehler(`B2-Download ${name}: Prüfsumme stimmt nicht — Original nicht verwendet.`)
        }
        const laenge = r.headers.get('content-length')
        if (laenge && Number(laenge) !== daten.length) {
          throw new B2Fehler(`B2-Download ${name}: unvollständig (${daten.length} von ${laenge} Bytes).`)
        }
        return daten
      }
      throw new B2Fehler(`B2-Download ${name}: Anmeldung abgelaufen und nicht erneuerbar.`)
    },
  }
}

let ausKonfiguration: B2Ablage | null | undefined
/** Die Verbindung aus `worker/.env` — `null`, wenn Backblaze nicht eingerichtet ist. */
export function b2AusKonfiguration(): B2Ablage | null {
  if (ausKonfiguration === undefined) {
    ausKonfiguration = b2Einrichtung().an
      ? b2Verbindung({ keyId: config.b2KeyId, appKey: config.b2AppKey, bucket: config.b2Bucket })
      : null
  }
  return ausKonfiguration
}
