/**
 * bild-werk.ts — WebGL2-Bildrechner fuer sieben Regler.
 *
 * Reines TypeScript, kein React, keine externe Abhaengigkeit.
 * Vorschau und Export laufen durch DIESELBEN Shader-Programme; das ist der
 * einzige Grund, warum hier ueberhaupt WebGL steht und nicht Canvas2D.
 */

export type Regler = {
  helligkeit: number // -100 .. +100, 0 = neutral
  kontrast: number
  saettigung: number
  highlights: number
  schatten: number
  temperatur: number
  schaerfe: number // 0 .. 100, 0 = aus
}

export const REGLER_VORGABE: Regler = {
  helligkeit: 0,
  kontrast: 0,
  saettigung: 0,
  highlights: 0,
  schatten: 0,
  temperatur: 0,
  schaerfe: 0,
}

/** Sind alle Regler in Nullstellung? Dann darf der Aufrufer das Original nehmen. */
export function istNeutral(r: Regler): boolean {
  return (
    r.helligkeit === 0 &&
    r.kontrast === 0 &&
    r.saettigung === 0 &&
    r.highlights === 0 &&
    r.schatten === 0 &&
    r.temperatur === 0 &&
    r.schaerfe === 0
  )
}

// ---------------------------------------------------------------------------
// Shader
// ---------------------------------------------------------------------------

const VERTEX_QUELLE = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform float uFlipY;
void main() {
  vec2 uv = aPos * 0.5 + 0.5;
  // uFlipY = -1 nur im Ausgabedurchgang des Exports: readPixels liefert die
  // Zeilen von unten nach oben, das Spiegeln hier dreht sie in Bildreihenfolge.
  vUv = vec2(uv.x, uFlipY < 0.0 ? 1.0 - uv.y : uv.y);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

const PRELUDE = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 fragColor;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
vec3 toLinear(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSRGB (vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(0.0031308, c)); }
`

/**
 * Durchgang 1 — alle Farbregler, vollstaendig in LINEAREM Licht.
 * In sRGB gerechnet wuerde jede Multiplikation den Farbton mitverschieben.
 */
const TON_QUELLE = `${PRELUDE}
uniform sampler2D uBild;
uniform float uHell;      // Belichtungsfaktor, 1.0 = neutral
uniform float uKontrast;  // Steigung um 0.5, 1.0 = neutral
uniform float uSaett;     // Mischfaktor, 1.0 = neutral
uniform float uHigh;      // -0.5 .. +0.5
uniform float uSchatten;  // -0.5 .. +0.5
uniform float uTemp;      // -1 .. +1

void main() {
  vec3 rgb = toLinear(texture(uBild, vUv).rgb);

  rgb *= uHell;
  // KONTRAST IST DER EINE SCHRITT, DER NICHT IN LINEAREM LICHT GEHOERT.
  //
  // Alles andere hier rechnet linear, und das ist richtig — Helligkeit,
  // Saettigung, Lichter/Schatten sind physikalische Groessen. Kontrast ist es
  // nicht: Er spreizt um die wahrgenommene Mitte, und die liegt in linearem
  // Licht bei 0.214, nicht bei 0.5.
  //
  // Zwei Fassungen und zwei Rechnungen bis hierher (02.09.2026):
  //   Drehpunkt 0.5 linear  → +100 machte aus Mittelgrau SCHWARZ
  //   Drehpunkt 0.214 linear → Mittelgrau blieb, aber sRGB 0.25 fiel bei
  //                            +50 schon auf 0.00 — die Vierteltöne soffen ab
  //   in sRGB gerechnet      → 0.25/0.50/0.75 wird zu 0.13/0.50/0.88
  //
  // Deshalb: hin nach sRGB, spreizen, zurueck. Ein Umweg von zwei Zeilen, aber
  // der Regler tut damit, was drauf steht.
  rgb = toLinear(clamp((toSRGB(rgb) - 0.5) * uKontrast + 0.5, 0.0, 1.0));
  rgb = max(rgb, 0.0);

  float Lsat = dot(rgb, LUMA);
  rgb = mix(vec3(Lsat), rgb, uSaett);
  rgb = max(rgb, 0.0);

  // Lichter/Schatten ueber eine GLOBALE Luminanzmaske. Eine lokale (also
  // weichgezeichnete) Maske erzeugt an harten Kanten Halos, weil sie die
  // Nachbarschaft mitzieht. Diese Maske haengt nur vom Pixel selbst ab und
  // kann deshalb per Konstruktion keine Halos machen.
  float L = clamp(dot(rgb, LUMA), 0.0, 1.0);
  float schattenMaske = pow(1.0 - L, 3.0);
  float lichterMaske  = pow(L, 3.0);
  // PLUS, nicht minus: Nach rechts geschoben werden die Lichter HELLER.
  // In der Vorlage stand hier ein Minus (positiv = Lichter zuruecknehmen, wie
  // es manche Programme machen). Daneben liegen aber sechs Regler, bei denen
  // rechts durchweg „mehr davon" heisst — Helligkeit, Kontrast, Saettigung.
  // Ein einzelner, der andersherum laeuft, ist keine Konvention, sondern eine
  // Falle.
  float gain = 1.0 + uSchatten * schattenMaske + uHigh * lichterMaske;
  rgb *= max(gain, 0.0); // multiplikativ, damit der Farbton bleibt

  // Temperatur: Kanal-Gain auf Rot/Blau. Gruen bleibt unangetastet, das waere
  // der Tint-Regler, den es hier nicht gibt.
  float Lvor = dot(rgb, LUMA);
  rgb.r *= 1.0 + 0.25 * uTemp;
  rgb.b *= 1.0 - 0.25 * uTemp;
  // Rueckfuehrung auf die alte Luminanz: ohne sie wird das Bild beim Waermen
  // messbar heller und beim Kuehlen dunkler, weil Rot und Blau sehr
  // unterschiedlich zur Helligkeit beitragen (0.2126 gegen 0.0722). Genau
  // dieser Schritt wird meistens weggelassen — und genau er macht den
  // Unterschied zwischen "waermer" und "heller und irgendwie orange".
  rgb *= Lvor / max(dot(rgb, LUMA), 1e-5);

  fragColor = vec4(max(rgb, 0.0), 1.0);
}`

/**
 * Durchgang 2/3 — separabler Gauss auf der LUMINANZ.
 * Zwei 1D-Durchgaenge statt einer 2D-Faltung: bei 17 Megapixeln ist der
 * Unterschied zwischen 2n und n*n Texturzugriffen der zwischen fluessig und
 * unbenutzbar.
 */
const BLUR_QUELLE = `${PRELUDE}
uniform sampler2D uQuelle;
uniform vec2 uSchritt;        // Texel-Schrittweite, einmal (1/b,0), einmal (0,1/h)
uniform float uGewichte[17];
uniform int uTaps;            // inkl. Mitte
uniform bool uAusFarbe;       // 1. Durchgang liest RGB, 2. Durchgang liest .r

float hole(vec2 uv) {
  vec4 t = texture(uQuelle, uv);
  return uAusFarbe ? dot(t.rgb, LUMA) : t.r;
}

void main() {
  float summe = hole(vUv) * uGewichte[0];
  for (int i = 1; i < uTaps; i++) {
    vec2 d = uSchritt * float(i);
    summe += (hole(vUv + d) + hole(vUv - d)) * uGewichte[i];
  }
  fragColor = vec4(summe, 0.0, 0.0, 1.0);
}`

/** Durchgang 4 — Unsharp Mask und Rueckwandlung nach sRGB. */
const FINAL_QUELLE = `${PRELUDE}
uniform sampler2D uFarbe;
uniform sampler2D uUnscharf;
uniform float uMenge;

void main() {
  vec3 rgb = texture(uFarbe, vUv).rgb;
  float L  = dot(rgb, LUMA);
  float Lb = texture(uUnscharf, vUv).r;

  // Drei Gegenmittel gegen Uebersteuerung:
  // (1) geschaerft wird nur die Luminanz, sonst entstehen bunte Kantensaeume;
  // (2) die Differenz wird begrenzt — das ist das eigentliche Halo-Gegenmittel,
  //     ohne sie wachsen Kanten an harten Kontrastspruengen unbegrenzt auf;
  // (3) unterhalb des Schwellwerts passiert gar nichts, das schuetzt Himmel und
  //     Haut davor, dass blosses Rauschen mitverstaerkt wird.
  float d = clamp(L - Lb, -0.10, 0.10);
  if (abs(d) < 0.012) d = 0.0;
  float Lneu = L + uMenge * d;
  // (4) Der Verstaerkungsfaktor wird geklemmt.
  //
  // L ist LINEARE Luminanz und in den Schatten winzig; die Grenze +-0.10 ist
  // dagegen absolut. Bei L = 0.001 und d = 0.05 ergaebe sich ein Faktor von 61
  // — an dunklen Kanten entstuenden weisse Sprenkel. Kein Fehler im Sinne von
  // Muell, aber ein kaputtes Bild, und zwar nur bei Nachtaufnahmen, wo es
  // niemand sucht.
  rgb *= clamp(Lneu / max(L, 1e-5), 0.5, 2.0);

  fragColor = vec4(toSRGB(clamp(rgb, 0.0, 1.0)), 1.0);
}`

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

const MAX_TAPS = 17

type Ziel = { fb: WebGLFramebuffer; tex: WebGLTexture }

class Programm {
  readonly prog: WebGLProgram
  private readonly orte = new Map<string, WebGLUniformLocation | null>()

  constructor(
    private readonly gl: WebGL2RenderingContext,
    vs: string,
    fs: string,
  ) {
    const v = uebersetzen(gl, gl.VERTEX_SHADER, vs)
    const f = uebersetzen(gl, gl.FRAGMENT_SHADER, fs)
    const p = gl.createProgram()
    if (!p) throw new Error('BildWerk: Shader-Programm konnte nicht angelegt werden.')
    gl.attachShader(p, v)
    gl.attachShader(p, f)
    gl.bindAttribLocation(p, 0, 'aPos')
    gl.linkProgram(p)
    gl.deleteShader(v)
    gl.deleteShader(f)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(p) ?? '(kein Protokoll)'
      gl.deleteProgram(p)
      throw new Error(`BildWerk: Shader-Programm nicht linkbar — ${log}`)
    }
    this.prog = p
  }

  ort(name: string): WebGLUniformLocation | null {
    const vorhanden = this.orte.get(name)
    if (vorhanden !== undefined) return vorhanden
    const neu = this.gl.getUniformLocation(this.prog, name)
    this.orte.set(name, neu)
    return neu
  }
}

function uebersetzen(gl: WebGL2RenderingContext, art: number, quelle: string): WebGLShader {
  const s = gl.createShader(art)
  if (!s) throw new Error('BildWerk: Shader konnte nicht angelegt werden.')
  gl.shaderSource(s, quelle)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s) ?? '(kein Protokoll)'
    gl.deleteShader(s)
    throw new Error(`BildWerk: Shader liess sich nicht uebersetzen — ${log}`)
  }
  return s
}

/** Anzahl Abtastpunkte je Seite inkl. Mitte, bei 3 Sigma abgeschnitten. */
function tapZahl(sigma: number): number {
  const s = Math.max(sigma, 1e-3)
  return Math.min(MAX_TAPS, Math.max(2, Math.ceil(3 * s) + 1))
}

/** Gauss-Gewichte fuer einen 1D-Durchgang, normiert inkl. der gespiegelten Seite. */
function gaussGewichte(sigma: number): Float32Array {
  const s = Math.max(sigma, 1e-3)
  const anzahl = tapZahl(s)
  const roh = new Float32Array(MAX_TAPS)
  let summe = 0
  for (let i = 0; i < anzahl; i++) {
    const w = Math.exp(-(i * i) / (2 * s * s))
    roh[i] = w
    summe += i === 0 ? w : 2 * w
  }
  for (let i = 0; i < anzahl; i++) roh[i] = roh[i] / summe
  return roh
}

// ---------------------------------------------------------------------------
// BildWerk
// ---------------------------------------------------------------------------

export class BildWerk {
  private readonly gl: WebGL2RenderingContext
  private readonly canvas: HTMLCanvasElement
  private readonly progTon: Programm
  private readonly progBlur: Programm
  private readonly progFinal: Programm
  private readonly vao: WebGLVertexArrayObject
  private readonly vbo: WebGLBuffer
  /** RGBA16F wenn moeglich; ohne EXT_color_buffer_float bleibt nur RGBA8. */
  private readonly hdrFormat: number
  private readonly hdrTyp: number
  private readonly blurFormat: number
  private readonly blurTyp: number
  private readonly blurBasis: number

  private textur: WebGLTexture | null = null
  private _breite = 0
  private _hoehe = 0

  /** Zwischenziele, gebunden an die zuletzt gerenderte Groesse. */
  private zielBreite = 0
  private zielHoehe = 0
  private zielFarbe: Ziel | null = null
  private zielBlurA: Ziel | null = null
  private zielBlurB: Ziel | null = null
  private zielAusgabe: Ziel | null = null

  private entsorgt = false

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    })
    if (!gl) {
      throw new Error(
        'BildWerk: Dieser Browser stellt kein WebGL2 bereit. Die Bildbearbeitung braucht ' +
          'WebGL2 (aktuelles Chrome/Edge/Firefox, Safari ab 15). Bitte auch pruefen, ob die ' +
          'Hardwarebeschleunigung im Browser eingeschaltet ist.',
      )
    }
    this.gl = gl

    // Float-Ziele sind Pflicht fuers Rechnen in linearem Licht: 8 Bit linear
    // bandet in den Schatten sichtbar, weil dort die sRGB-Kurve die Werte
    // spreizt. Fehlt die Erweiterung, wird trotzdem gerechnet — mit dieser
    // Einbusse statt mit einer Fehlermeldung.
    const float = gl.getExtension('EXT_color_buffer_float') !== null
    this.hdrFormat = float ? gl.RGBA16F : gl.RGBA8
    this.hdrTyp = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
    // Die Unschaerfemaske braucht nur einen Kanal — bei 17 MP sind das 34 MB
    // statt 136 MB je Zwischenbild.
    this.blurFormat = float ? gl.R16F : gl.RGBA8
    this.blurTyp = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE
    this.blurBasis = float ? gl.RED : gl.RGBA

    this.progTon = new Programm(gl, VERTEX_QUELLE, TON_QUELLE)
    this.progBlur = new Programm(gl, VERTEX_QUELLE, BLUR_QUELLE)
    this.progFinal = new Programm(gl, VERTEX_QUELLE, FINAL_QUELLE)

    const vao = gl.createVertexArray()
    const vbo = gl.createBuffer()
    if (!vao || !vbo) throw new Error('BildWerk: Geometriepuffer konnte nicht angelegt werden.')
    this.vao = vao
    this.vbo = vbo
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    // Ein einziges uebergrosses Dreieck statt zweier: keine Naht in der Mitte.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
  }

  get breite(): number {
    return this._breite
  }

  get hoehe(): number {
    return this._hoehe
  }

  /** Bild laden. Wirft, wenn es groesser als MAX_TEXTURE_SIZE ist. */
  laden(quelle: ImageBitmap): void {
    this.pruefeLebend()
    const gl = this.gl
    // Auf dem Zielrechner (Radeon 780M) sind das 16384 — auf anderen Geraeten
    // koennen es 2048 sein, deshalb wird hier wirklich gefragt statt geraten.
    const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    if (quelle.width > max || quelle.height > max) {
      throw new Error(
        `BildWerk: Das Bild ist ${quelle.width}x${quelle.height} Pixel gross, diese ` +
          `Grafikkarte verarbeitet aber hoechstens ${max}x${max} Pixel. Bitte das Bild ` +
          `vorher verkleinern.`,
      )
    }

    if (this.textur) gl.deleteTexture(this.textur)
    const tex = gl.createTexture()
    if (!tex) throw new Error('BildWerk: Bildtextur konnte nicht angelegt werden.')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    // Beim Hochladen spiegeln, damit das Bild in der Vorschau richtig herum
    // steht (WebGL zaehlt y von unten, das Canvas von oben).
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, quelle)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    // Mipmaps allein wegen der Vorschau: 17 MP ohne Mipmap auf ein paar hundert
    // Pixel heruntergerechnet flimmert und zeigt Kanten, die im Export nicht
    // vorkommen — die Vorschau wuerde etwas anderes zeigen als das Ergebnis.
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)

    this.textur = tex
    this._breite = quelle.width
    this._hoehe = quelle.height
  }

  /** In das Canvas des Konstruktors zeichnen (Vorschau). */
  /**
   * Vorschau zeichnen.
   *
   * Die Grösse des Canvas bestimmt der Aufrufer — hier wird sie nur gelesen.
   * Ein Canvas ohne gesetzte Masse ist 300×150 gross; genau so sah die erste
   * Fassung am 02.09.2026 im Browser aus.
   */
  zeichnen(r: Regler): void {
    this.pruefeLebend()
    const gl = this.gl
    const b = Math.max(1, this.canvas.width)
    const h = Math.max(1, this.canvas.height)
    this.rechnen(r, b, h, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  /**
   * In voller Aufloesung rechnen und als Blob liefern (PNG).
   *
   * Danach werden die vollauflösenden Zwischenziele wieder freigegeben. Bei
   * 25 Megapixeln sind das mehrere hundert Megabyte auf der Grafikeinheit, und
   * nach dem Export zeichnet normalerweise nichts mehr — bleibt der Dialog nach
   * einem misslungenen Upload offen, haengen sie sonst bis zum Schliessen.
   */
  async export(r: Regler): Promise<Blob> {
    this.pruefeLebend()
    const gl = this.gl
    const b = this._breite
    const h = this._hoehe
    if (b === 0 || h === 0) throw new Error('BildWerk: Es ist kein Bild geladen.')

    const ausgabe = this.ausgabeZiel(b, h)
    this.rechnen(r, b, h, ausgabe)

    const roh = new Uint8Array(b * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, ausgabe.fb)
    gl.readPixels(0, 0, b, h, gl.RGBA, gl.UNSIGNED_BYTE, roh)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)

    const flaeche = document.createElement('canvas')
    flaeche.width = b
    flaeche.height = h
    const ctx = flaeche.getContext('2d')
    if (!ctx) throw new Error('BildWerk: 2D-Kontext fuer den Export nicht verfuegbar.')
    ctx.putImageData(new ImageData(new Uint8ClampedArray(roh.buffer), b, h), 0, 0)

    const blob = await new Promise<Blob>((loesen, ablehnen) => {
      flaeche.toBlob((blob) => {
        if (blob) loesen(blob)
        else ablehnen(new Error('BildWerk: Der Export liess sich nicht als PNG kodieren.'))
      }, 'image/png')
    })

    // Und jetzt WIRKLICH freigeben. Der Kommentar oben behauptete das schon,
    // der Rumpf tat es nicht. Bei einem 21-Megapixel-Bild blieben so rund
    // 340 MB Grafikspeicher stehen, wenn der Upload scheitert und der Dialog
    // offen bleibt — ohne Reglerbewegung zeichnet nichts neu, also raeumt auch
    // nichts auf. Derselbe Fehlertyp wie beim Lichter-Regler: ein Kommentar,
    // der dem Code widerspricht.
    for (const z of [this.zielFarbe, this.zielBlurA, this.zielBlurB, this.zielAusgabe]) {
      if (!z) continue
      gl.deleteFramebuffer(z.fb)
      gl.deleteTexture(z.tex)
    }
    this.zielFarbe = null; this.zielBlurA = null; this.zielBlurB = null
    this.zielAusgabe = null
    this.zielBreite = 0; this.zielHoehe = 0
    return blob
  }

  /** Texturen und Kontext freigeben. */
  freigeben(): void {
    if (this.entsorgt) return
    this.entsorgt = true
    const gl = this.gl
    for (const z of [this.zielFarbe, this.zielBlurA, this.zielBlurB, this.zielAusgabe]) {
      if (!z) continue
      gl.deleteFramebuffer(z.fb)
      gl.deleteTexture(z.tex)
    }
    this.zielFarbe = null
    this.zielBlurA = null
    this.zielBlurB = null
    this.zielAusgabe = null
    if (this.textur) gl.deleteTexture(this.textur)
    this.textur = null
    gl.deleteBuffer(this.vbo)
    gl.deleteVertexArray(this.vao)
    gl.deleteProgram(this.progTon.prog)
    gl.deleteProgram(this.progBlur.prog)
    gl.deleteProgram(this.progFinal.prog)
    // Ohne loseContext bleibt der Speicher bis zur Garbage Collection liegen;
    // bei 17-MP-Bildern sind das mehrere hundert MB Grafikspeicher.
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }

  // -------------------------------------------------------------------------
  // Innenleben
  // -------------------------------------------------------------------------

  private pruefeLebend(): void {
    if (this.entsorgt) throw new Error('BildWerk: Dieses Werk wurde bereits freigegeben.')
  }

  /**
   * Der gemeinsame Rechenweg von Vorschau und Export. `ziel === null` heisst:
   * ins Canvas zeichnen. Vorschau und Export unterscheiden sich einzig in
   * Aufloesung und Zielpuffer, in keiner einzigen Shader-Zeile.
   */
  private rechnen(r: Regler, b: number, h: number, ziel: Ziel | null): void {
    const gl = this.gl
    if (!this.textur) throw new Error('BildWerk: Es ist kein Bild geladen.')

    this.zwischenzieleSichern(b, h)
    const farbe = this.zielFarbe
    const blurA = this.zielBlurA
    const blurB = this.zielBlurB
    if (!farbe || !blurA || !blurB) throw new Error('BildWerk: Zwischenpuffer fehlen.')

    gl.bindVertexArray(this.vao)
    gl.viewport(0, 0, b, h)

    // --- Durchgang 1: Farbregler -------------------------------------------
    const t = this.progTon
    gl.useProgram(t.prog)
    gl.bindFramebuffer(gl.FRAMEBUFFER, farbe.fb)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.textur)
    gl.uniform1i(t.ort('uBild'), 0)
    gl.uniform1f(t.ort('uFlipY'), 1)
    // Helligkeit als Belichtung in Blenden: +100 = eine Blende heller. Additiv
    // im linearen Raum wuerde die Schatten aufhellen und den Kontrast fressen.
    gl.uniform1f(t.ort('uHell'), Math.pow(2, r.helligkeit / 100))
    const c = r.kontrast / 100
    // Symmetrisch: +100 verdoppelt die Steigung, -100 halbiert sie.
    gl.uniform1f(t.ort('uKontrast'), c >= 0 ? 1 + c : 1 / (1 - c))
    gl.uniform1f(t.ort('uSaett'), 1 + r.saettigung / 100)
    // Vorzeichen: positiv HELLT BEIDE AUF — Lichter wie Schatten. Rechts heisst
    // hier dasselbe wie bei jedem Regler daneben: mehr davon.
    //
    // Hier stand die alte Fassung („positiv nimmt die Lichter zurueck"), waehrend
    // der Shader laengst das Gegenteil tat. Ein Kommentar, der dem Code
    // widerspricht, ist schlimmer als keiner: Wer hier vorbeikommt, haelt das
    // Plus im Shader fuer den Fehler und dreht es zurueck.
    gl.uniform1f(t.ort('uHigh'), (r.highlights / 100) * 0.5)
    gl.uniform1f(t.ort('uSchatten'), (r.schatten / 100) * 0.5)
    gl.uniform1f(t.ort('uTemp'), r.temperatur / 100)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    // --- Durchgang 2+3: Gauss auf der Luminanz ------------------------------
    const menge = (r.schaerfe / 100) * 1.2
    // Bei Menge 0 wird die Maske im Shader mit 0 gewichtet; dann darf hier
    // irgendeine gueltige Textur haengen, gerechnet wird sie ohnehin nicht.
    let unscharf: WebGLTexture = farbe.tex
    if (r.schaerfe > 0) {
      // Der Radius wird in Pixeln der GERENDERTEN Aufloesung gebraucht. Die
      // Vorgabe 1..2 px bezieht sich auf die volle Aufloesung; in der Vorschau
      // ist dasselbe Motiv kleiner, also muss der Radius mitschrumpfen. Ohne
      // diese Skalierung verspricht die Vorschau eine Schaerfe, die der Export
      // nicht einloest.
      const radiusVoll = 1 + r.schaerfe / 100
      const skala = b / Math.max(this._breite, 1)
      // Unter einem halben Pixel ist der Kern faktisch ein einzelnes Texel und
      // die Unsharp Mask waere wirkungslos — daher diese untere Schranke. In
      // sehr kleinen Vorschauen zeigt sie die Schaerfe deshalb etwas
      // grosszuegiger, als der Export sie an dieser Stelle liefert.
      const radius = Math.max(0.5, radiusVoll * skala)
      const sigma = radius / 2
      const gewichte = gaussGewichte(sigma)
      const taps = tapZahl(sigma)

      const bl = this.progBlur
      gl.useProgram(bl.prog)
      gl.uniform1f(bl.ort('uFlipY'), 1)
      gl.uniform1i(bl.ort('uQuelle'), 0)
      gl.uniform1fv(bl.ort('uGewichte'), gewichte)
      gl.uniform1i(bl.ort('uTaps'), taps)

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurA.fb)
      gl.bindTexture(gl.TEXTURE_2D, farbe.tex)
      gl.uniform2f(bl.ort('uSchritt'), 1 / b, 0)
      gl.uniform1i(bl.ort('uAusFarbe'), 1)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      gl.bindFramebuffer(gl.FRAMEBUFFER, blurB.fb)
      gl.bindTexture(gl.TEXTURE_2D, blurA.tex)
      gl.uniform2f(bl.ort('uSchritt'), 0, 1 / h)
      gl.uniform1i(bl.ort('uAusFarbe'), 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)

      unscharf = blurB.tex
    }

    // --- Durchgang 4: Unsharp Mask und Ausgabe ------------------------------
    const f = this.progFinal
    gl.useProgram(f.prog)
    gl.bindFramebuffer(gl.FRAMEBUFFER, ziel ? ziel.fb : null)
    gl.viewport(0, 0, b, h)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, farbe.tex)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, unscharf)
    gl.uniform1i(f.ort('uFarbe'), 0)
    gl.uniform1i(f.ort('uUnscharf'), 1)
    gl.uniform1f(f.ort('uMenge'), menge)
    // Die Vorschau braucht die Spiegelung, der Export nicht — nicht umgekehrt.
    //
    // Am 02.09.2026 am laufenden Browser gemessen: Mit `ziel ? -1 : 1` stand das
    // Bild in der Vorschau auf dem Kopf. Der Grund ist die Kette aus drei
    // Spiegelungen: UNPACK_FLIP_Y_WEBGL beim Hochladen, die Bildpunktrichtung
    // des Vollbild-Vierecks, und beim Export zusaetzlich readPixels, das von
    // unten nach oben liest. Hergeleitet hatte ich es andersherum — die Messung
    // hat entschieden.
    gl.uniform1f(f.ort('uFlipY'), ziel ? 1 : -1)
    gl.drawArrays(gl.TRIANGLES, 0, 3)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindVertexArray(null)
  }

  private zwischenzieleSichern(b: number, h: number): void {
    if (this.zielBreite === b && this.zielHoehe === h && this.zielFarbe) return
    const gl = this.gl
    for (const z of [this.zielFarbe, this.zielBlurA, this.zielBlurB]) {
      if (!z) continue
      gl.deleteFramebuffer(z.fb)
      gl.deleteTexture(z.tex)
    }
    this.zielFarbe = null
    this.zielBlurA = null
    this.zielBlurB = null
    this.zielBreite = 0
    this.zielHoehe = 0

    this.zielFarbe = this.neuesZiel(b, h, this.hdrFormat, this.hdrTyp, gl.RGBA)
    this.zielBlurA = this.neuesZiel(b, h, this.blurFormat, this.blurTyp, this.blurBasis)
    this.zielBlurB = this.neuesZiel(b, h, this.blurFormat, this.blurTyp, this.blurBasis)
    this.zielBreite = b
    this.zielHoehe = h
  }

  /** Ausgabepuffer des Exports — eigener Platz, damit die Vorschau ihn nicht wegwirft. */
  private ausgabeZiel(b: number, h: number): Ziel {
    const gl = this.gl
    if (this.zielAusgabe) {
      gl.deleteFramebuffer(this.zielAusgabe.fb)
      gl.deleteTexture(this.zielAusgabe.tex)
      this.zielAusgabe = null
    }
    const z = this.neuesZiel(b, h, gl.RGBA8, gl.UNSIGNED_BYTE, gl.RGBA)
    this.zielAusgabe = z
    return z
  }

  private neuesZiel(b: number, h: number, intern: number, typ: number, basis: number): Ziel {
    const gl = this.gl
    const tex = gl.createTexture()
    const fb = gl.createFramebuffer()
    if (!tex || !fb) throw new Error('BildWerk: Zwischenpuffer konnte nicht angelegt werden.')
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, intern, b, h, 0, basis, typ, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    // NEAREST genuegt: alle Zwischendurchgaenge tasten exakt Texelmitten ab.
    // Damit haengt nichts an OES_texture_float_linear.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER)
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.deleteFramebuffer(fb)
      gl.deleteTexture(tex)
      throw new Error(
        `BildWerk: Zwischenpuffer ${b}x${h} ist nicht nutzbar (Status 0x${status.toString(16)}). ` +
          `Wahrscheinlich reicht der Grafikspeicher fuer diese Bildgroesse nicht.`,
      )
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return { fb, tex }
  }
}
