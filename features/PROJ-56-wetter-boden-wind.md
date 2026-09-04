# PROJ-56: Wetter, Boden und Wind trennen

## Status: Approved (von Mark im Betrieb bestätigt)
**Created:** 2026-09-04

## Warum

Mark am 04.09.2026:

> „Wenn man Schnee auswählt, dann bedeutet das für den Prompt, dass auch
> Schnee fällt und Schnee am Boden liegt. Es kann natürlich auch sein, dass
> zwar Schnee liegt, aber die Sonne scheint. Sollte man da nicht
> differenzieren? Dann geht es noch um Wind. In einem Studio könnte auch eine
> Windmaschine sein, sodass das Haar verweht wird. Diese Tatsache sollte man
> auch noch mit einbauen können. Ist ja auch realistisch."

Beides an der Datei nachgemessen, beides trifft zu:

**1. `schnee` sagt zwei Dinge auf einmal.**
`scene-builder-options.ts`: `{ key: 'schnee', prompt: 'falling snow over
snow-covered surfaces' }`. Fallender Schnee UND Schneedecke, untrennbar. Der
häufigste Winterfall — Schneedecke bei klarem Himmel — ist damit gar nicht
formulierbar. Wer ihn will, bekommt zwangsweise Schneefall dazu.

**2. Wind steckt in der Wetterliste und gilt nur draußen.**
Er kommt einmal vor, als `sturm` (`turbulent stormy sky with strong wind`) —
also nur in der stärksten Stufe und untrennbar an einen Sturmhimmel gekoppelt.
`buildEnvironmentSentence` wertet `weather` ausschließlich bei
`scene_type === 'outdoor'` aus. Eine Windmaschine im Studio, die das Haar
bewegt, lässt sich nicht ausdrücken — obwohl das eines der häufigsten
Werkzeuge der Porträtfotografie ist.

Das ist derselbe Denkfehler wie beim Studio-Hintergrund (behoben am selben
Tag): unabhängige Dinge stecken in einem Feld und lassen sich deshalb nicht
unabhängig setzen.

## Was gebaut werden soll

Drei Achsen statt einer.

### 1. Wetter — was vom Himmel kommt

Bleibt, wird aber auf seine eigentliche Bedeutung eingeengt. `schnee` heißt
künftig „Schneefall" und beschreibt nur noch den Niederschlag.

**Kein Schlüssel wird entfernt.** Gespeicherte Presets tragen `weather:
'schnee'` oder `'sturm'` in der Datenbank, und `buildEnvironmentSentence`
greift mit `WEATHERS.find(...)!.prompt` zu — ein fehlender Schlüssel stürzt
dort hart ab, ohne Auffangnetz. Umbenennen ja, Löschen nein.

### 2. Bodenzustand — was liegt (neu, nur draußen)

Was am Boden ist, hängt nicht am Himmel: Schnee liegt oft bei Sonne, eine
Straße bleibt nach dem Regen nass, im Herbst liegt Laub. Vorschlag:
Schneedecke, nasser Boden, Pfützen, Laub, trocken/staubig.

Damit ist Marks Beispiel formulierbar: **Sonnig + Schneedecke.**

### 3. Wind — eine eigene Stufe, drinnen wie draußen (neu)

Vier Stufen von windstill bis stark. Draußen bewegt er Haare, Kleidung, Blätter
und Wasseroberflächen. **Drinnen ist es die Windmaschine** — derselbe Regler,
anderer Text im Prompt: fliegendes Haar und bewegter Stoff ohne
Wettererscheinungen ringsum.

Das ist der Grund, warum Wind ein eigenes Feld sein muss und nicht in die
Wetterliste gehört: Die Wetterliste gilt nur draußen, der Wind soll aber
gerade auch drinnen wirken.

## Was das berührt

- `scene-builder-options.ts` — Liste `schnee` umformulieren, zwei neue Listen
- `szene-prompt.ts` — zwei neue Felder im Typ `Scene`, Auswertung in
  `buildEnvironmentSentence` (drinnen UND draußen)
- `scene-preset-types.ts` — zwei neue Felder, damit Presets sie mitnehmen.
  `EMPTY_PRESET_CONFIG` fängt alte Presets ohne diese Felder auf; das ist der
  bestehende Weg und trägt hier ohne Änderung.
- `scene-builder/page.tsx` — Bodenzustand zur Szenenbedingungen-Karte,
  Wind sichtbar in beiden Szenentypen
- Tests, einschließlich der wörtlichen Aufzeichnungen

## Ausdrücklich NICHT

- **Kein Schlüssel wird gelöscht.** Siehe oben — alte Presets würden abstürzen.
- Keine Wetterlogik, die Kombinationen verbietet. „Schneedecke bei 30 Grad"
  ist Marks Entscheidung, nicht meine; das Werkzeug soll nicht klüger sein
  wollen als er.

## Im Betrieb bestätigt (04.09.2026)

Mark: „Hab jetzt mal was angegeben. Und zwar Sommer, Schneefall und Laub auf
dem Boden. Hat gut funktioniert."

Ein gut gewählter Fall, und er trifft genau den Kern: **Sommer + Schneefall +
Laub ist bewusst widersprüchlich** — und vorher schlicht nicht formulierbar.
„Schnee" brachte zwangsweise die Schneedecke mit, und Laub am Boden gab es
als Auswahl gar nicht.

Er bestätigt damit auch die Entscheidung aus „Ausdrücklich NICHT": keine
Wetterlogik, die Kombinationen verbietet. Hätte das Werkzeug widersprüchliche
Angaben abgefangen, wäre genau dieses Bild unmöglich gewesen.
