# PROJ-55: Scene Builder neu gestalten (helles Papier, Karten, Bausteine nach oben)

## Status: In Review
**Created:** 2026-09-04

## Warum

Mark am 04.09.2026, nachdem er den Scene Builder aufgemacht hat:

> „Alles ist sehr kleingeschrieben. Ich kann fast nichts lesen, auch auf der
> rechten Seite ist das so hingequetscht. … auch dieses Grau auf diesem
> Schwarz und auch unten vor allem, wo ich Charakter, Outfit und Location
> auswählen kann, das sieht man ja fast gar nicht."

Das ist keine Geschmacksfrage. Der Scene Builder ist der Bildschirm, an dem
Mark die meiste Zeit verbringt, und er kann ihn nicht lesen.

## Der Befund — an der Datei gemessen, nicht geschätzt

Eine größere Schrift allein repariert diesen Bildschirm nicht. Vier Sachen
sind strukturell:

**1. Der Bildschirm beginnt mit dem Falschen.**
In `src/app/(app)/scene-builder/page.tsx` steht in der Mitte: Szenentyp
(Zeile 878), Szenenbedingungen (908), Kamera-Einstellungen (933),
Studio-Hintergrund (945) — und **erst ab Zeile 959 die acht Bausteine**. Man
stellt Tageszeit, Objektiv und Tiefenschärfe ein, bevor man weiß, wer im Bild
ist. Auf einem normalen Monitor sind die Bausteine beim Öffnen gar nicht
sichtbar. Marks „das sieht man ja fast gar nicht" ist deshalb nicht nur ein
Kontrast-, sondern ein Positionsproblem.

**2. Die Mitte ist auf 672px gedeckelt.**
Die Spalte ist `flex-1`, also elastisch — aber jeder Block darin trägt
`max-w-2xl mx-auto` (5 Vorkommen). Auf einem breiten Monitor entstehen links
und rechts leere Streifen, während die rechte Spalte mit `w-80` (320px) alles
ineinanderquetscht. Der Bildschirm ist nicht zu voll, er **benutzt die
vorhandene Breite nicht** — deshalb wirkt er gleichzeitig gequetscht und leer.

**3. Alles ist gleich laut.**
Neun Einstellungsgruppen, jede mit `text-[11px] uppercase tracking-wider`
Überschrift und `text-[11px]` Knöpfen. Es gibt keine Stufe, an der das Auge
sich festhält. Sichtbarkeit entsteht hier nicht durch mehr Kontrast, sondern
durch **weniger gleichzeitig Sichtbares**.

**4. Die Bildlaufleisten sind versteckt.**
Alle drei Spalten tragen `style={{ right: '-17px' }}`. Nichts zeigt an, dass
unten noch etwas kommt — bei einer Spalte, deren wichtigster Inhalt unten
liegt, eine unglückliche Kombination.

## Was gebaut werden soll

Die Vorlage ist verbindlich und liegt als fertiger Bildschirm vor:
`C:\Users\markg\Documents\Claude-Bilder\scene-builder-mockups\4-mischung.html`
(Bildschirmfoto daneben). Sie ist aus drei Entwürfen entstanden, die Mark
gegeneinander gehalten hat; die Mischung ist seine eigene.

### Die Anmutung: helles Papier

Warmes Naturweiß (`#f5f0e4`) als Arbeitsfläche, Karten eine Spur heller. Die
Navigationsleiste links **bleibt dunkel**. Mark: „Das helle Design von drei
auf jeden Fall … mit dem Papier gelblich weiß, so wie es ähnlich war wie bei
Fuchs News."

Dazu die druckgrafischen Zeichen aus dem Kontaktbogen-Entwurf: Passkreuze,
Doppellinie, Randnummern (`01 — CHR` …), Perforationsleiste, Fußzeile.
**Diese Details sind nicht optional** — bei Mark entscheiden Zierlinien,
Konturen und feine Marken über die Stimmung.

### Reichweite: NUR der Scene Builder

Mark am 04.09.2026 ausdrücklich gefragt und beantwortet: erst nur diese eine
Seite. Der Rest der App bleibt dunkel. Die Farbwerte werden deshalb als
**auf die Seite begrenzte Variablen** angelegt, nicht als globales Thema —
aber so, dass ein späteres Ausrollen wenig Arbeit ist.

### Die Ordnung

1. **Bausteine ganz nach oben**, mit Zähler „1 von 8 belegt". Das ist der
   billigste der vier Punkte: die `max-w-2xl`-Blöcke sind Geschwister, der
   Bausteine-Block wird nur vor den Szenentyp gezogen.
2. **Einstellungen in gerahmten Karten mit Typenschild**, nebeneinander statt
   untereinander: Szenentyp, Szenenbedingungen, Kamera-Einstellungen,
   Bild & Schärfe, Studio-Hintergrund, Zugeklappt.
3. **Selten gebrauchte Gruppen zugeklappt**, mit ihrem aktuellen Wert in
   Orange sichtbar (`Kamerawinkel — Augenhöhe`).
4. **Der Deckel von 672px fällt**, die Breite wird genutzt.

### Zwei Regeln, die beim Übertragen entschieden haben

**Der Rahmen darf nicht mitreden.** Im dunklen Entwurf trägt der Kasten
Bedeutung, weil er heller ist als der Grund. Auf Papier ist ein kräftiger
Rahmen sofort ein Formularfeld. Kontur `#cec6b2`, ein Haar dunkler als das
Papier, plus Schatten 1px/3px bei 9%.

**Zwei Linienarten dürfen sich nicht mischen.** Die Passkreuze und
Doppellinien sind scharfe Druckgrafik, die Karten sind weiche aufgelegte
Flächen. Alles Grafische bleibt **oben** beim Bausteinbogen, alles
Karten-Artige **unter** der Doppellinie. Die Doppellinie ist damit nicht
Zierde, sondern die Grenze zwischen zwei Sprachen. Vermischt kippt es ins
Unruhige.

### Kennfarben

Vier Kategorien, deutlich unterscheidbar: Grün `#2f7d4a` (Szenentyp),
Blaugrün `#0e6f92` (Szenenbedingungen), Bernstein `#b07d05` (Kamera),
Rostrot `#a8392b` (Bild & Schärfe). Je 5px Kante am Typenschild plus leichte
Tonfläche und farbige Schrift.

**Bild & Schärfe war zuerst orange und wurde bewusst auf Rostrot geändert:**
Orange ist in dieser App die Farbe für „ausgewählt". Ein oranges Typenschild
neben orangen Knöpfen liest sich wie ein aktiver Zustand und arbeitete damit
gegen Marks Wunsch, die Kategorien unterscheiden zu können. Orange gehört
jetzt ausschließlich der Auswahl.

„Studio-Hintergrund" und „Zugeklappt" bleiben neutral-grau — das sind keine
Einstellungskategorien wie die anderen vier.

### Lesbarkeit

Nichts unter 13px. Fließtext und Knöpfe 14–15px, Überschriften klar darüber.
Das ist der eigentliche Auftrag; alles andere ist die Voraussetzung dafür.

## Ausdrücklich NICHT in diesem Feature

- **Kein Aufklappen der Auswahl am Steckplatz.** War als Richtung 2 gebaut
  und von Mark verworfen, mit guter Begründung: „dann leidet die
  Übersichtlichkeit, wenn ich was auswählen muss. Also wär dann alles zu
  klein dargestellt, die Fotos." Er wählt an Gesichtern und Stoffen, nicht an
  Namen — ein Popover kann diese Fläche nie bieten. Die linke Spalte bleibt
  der Ort der Auswahl. **Damit entfällt zugleich der teuerste Umbau**: der
  Bausteinbrowser mit acht Reitern, Suchfeld und Nachladen der Referenzbilder
  aus Supabase müsste sonst gedoppelt werden.
- **Keine Änderung am Verhalten.** Reine Darstellung. Kein Prompt-Bau, keine
  Auftragslogik, keine Datenbank.
- **Keine anderen Seiten.** Siehe Reichweite.
- **Der Reihen-Kasten bleibt funktional wie er ist** (PROJ-44) und wird nur
  mitgestaltet. Dass seine Achse falsch gewählt ist, ist ein eigenes Feature.

## Offen für später

- Ob die übrigen Seiten nachziehen. Mark entscheidet das, wenn er den Scene
  Builder im Betrieb gesehen hat.
- Die versteckten Bildlaufleisten (`right: '-17px'`) — durch die neue Ordnung
  entschärft, aber nicht beseitigt.
