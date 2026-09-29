/**
 * Die druckgrafischen Kleinteile des Scene Builders (PROJ-92), hier noch
 * einmal — dort sind sie lokale Funktionen der Seite und nicht ausführbar von
 * außen. Die Klassen (`sb-reg`, `sb-dbl`, `sb-sprock`) kommen aus
 * `scene-builder/papier.css`; nur das Markup steht doppelt.
 */

/** Passkreuz — reine Zierde. */
export function Passkreuz() {
  return <span className="sb-reg" aria-hidden="true"><i /></span>
}

/** Doppellinie: Grenze zwischen Druckgrafik (oben) und weichen Karten (unten). */
export function Doppellinie() {
  return <div className="sb-dbl my-4" aria-hidden="true" />
}

/** Perforationsleiste unter dem Bausteinbogen. */
export function Perforation() {
  return (
    <div className="sb-sprock mt-3 pt-2" aria-hidden="true">
      {Array.from({ length: 60 }).map((_, i) => <i key={i} />)}
    </div>
  )
}
