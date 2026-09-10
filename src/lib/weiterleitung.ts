/*
  WOHIN DIE ANMELDUNG ZURUECKFUEHREN DARF.

  Seit dem 10.09.2026 merkt sich der Proxy in `?weiter=`, wohin jemand
  eigentlich wollte, bevor er zur Anmeldung geschickt wurde. Das ist noetig,
  seit es Verweise auf einzelne Prompts gibt: Marks KI-Zentrale liest den
  Tresor mit und verweist aus ihrer Suche hierher — und genau der Klick, der
  aus einem anderen Programm kommt, ist auch der, bei dem man am ehesten noch
  nicht angemeldet ist.

  DAS IST EINE OFFENE WEITERLEITUNG, WENN MAN NICHT AUFPASST. Der Wert steht in
  der Adresszeile und ist damit von aussen bestimmbar. Ohne Pruefung koennte
  eine fremde Seite `?weiter=https://…` unterschieben, und die Anmeldung
  schickte Mark anschliessend woanders hin — mit dem guten Gefuehl, gerade bei
  sich selbst gewesen zu sein. Das ist der uebliche Weg, wie so etwas
  missbraucht wird, und er ist mit einer Zeile zu schliessen.

  DESHALB EINE EIGENE DATEI: die Entscheidung ist drei Zeilen lang und
  sicherheitsrelevant. In `proxy.ts` haette sie zwischen Sitzungsverwaltung und
  Weiterleitungen gestanden und waere nur zusammen mit einem nachgebauten
  Supabase pruefbar gewesen. Hier ist sie es allein.
*/

/** Der Weg, wenn er in dieses Haus fuehrt — sonst `null`. */
export function hiesigerWeg(weiter: string | null | undefined): string | null {
  if (!weiter) return null;
  // Genau EIN Schraegstrich am Anfang. `//fremd.de` waere protokollrelativ und
  // ginge nach draussen; ein rueckwaerts geneigter Strich taeuscht in manchen
  // Browsern dasselbe vor.
  if (!weiter.startsWith("/")) return null;
  if (weiter.startsWith("//")) return null;
  if (weiter.includes("\\")) return null;
  // Steuerzeichen (auch Zeilenumbrueche) haben in einer Adresse nichts zu
  // suchen und koennen in Kopfzeilen Unfug anrichten.
  if ([...weiter].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
    return null;
  }
  if (weiter.length > 512) return null;
  return weiter;
}
