# PROJ-42: KI-Vergrößerung mit Detailrekonstruktion (SeedVR2 über fal.ai)

## Status: In Review
**Created:** 2026-09-02

## Warum

Mark hat den ByteDance-Upscaler (in Jimeng/Dreamina) ausprobiert und war
begeistert. Unser Verfahren aus PROJ-39 kann das grundsätzlich nicht: Lanczos
**verteilt** vorhandene Bildpunkte klüger, es **erfindet** keine Details. Genau
das ist der sichtbare Unterschied.

Seine Frage war dreiteilig: lokal betreiben, welche Hardware, oder per API.

## Was gemessen wurde

**Lokal scheidet auf diesem PC aus.** Gemessen am 02.09.2026:

```
GPU:  AMD Radeon 780M (integriert, kein eigener Videospeicher)
RAM:  30 GB (geteilt)
CUDA: nicht vorhanden
```

SeedVR2 ist unter **Apache 2.0** frei verfügbar (ByteDance-Seed/SeedVR2-3B
und -7B), und es gibt ComfyUI-Nodes dafür. Aber es braucht NVIDIA und je nach
Quantisierung 8–24 GB **dedizierten** Speicher. Beides fehlt hier. Das ist auch
der Grund, warum ComfyUI in diesem Projekt nie mitgespielt hat.

**Anbietervergleich** für ein Bild 1536×864, verdoppelt:

| Anbieter | Modell | 2× | 4× | Detailrekonstruktion |
|---|---|---|---|---|
| **fal.ai** | **SeedVR2** | **≈ 0,5 ¢** | ≈ 2 ¢ | ja |
| fal.ai | Recraft Crisp | 0,4 ¢ | 0,4 ¢ | nein |
| Replicate | Clarity | ≈ 1,9 ¢ | ≈ 1,9 ¢ | ja, stildriftend |
| Replicate | Topaz | 5 ¢ | 5 ¢ | ja |
| Magnific / Freepik | Creative | ≈ 20 ¢ | ≈ 40 ¢ | ja |
| Stability | Creative Upscale | 60 ¢ | 60 ¢ | ja |

fal.ai gewinnt in beiden Richtungen zugleich: dasselbe Modell, das Mark
überzeugt hat, und der niedrigste Preis. Dazu Vorkasse ohne Abo, nur
erfolgreiche Läufe kosten, und eine Warteschlangen-Schnittstelle, die eins zu
eins auf unsere passt.

Nicht gewählt: Magnific (API hinter Abo, HTTP 403 auf die Doku), Topaz direkt
(teurer als dasselbe Topaz über fal), BytePlus (führt gar keinen Bild-Upscaler
im API-Katalog — der Upscaler in Jimeng ist Produktfunktion, kein API-Produkt).

## Wie es gebaut ist

Kein zweiter Auftragstyp — PROJ-39 hatte die Vergrößerung schon als eigenen
`job_type` in derselben Warteschlange. Dazu kommt nur die Frage **womit**.

**Datenbank** (`docs/proj-42-ki-upscaler.sql`): Spalte `upscaler` in
`image_jobs`, Werte `lanczos` oder `seedvr2`. Vier Schranken:

- der Wert muss aus der Liste sein
- ein Vergrößerungsauftrag **braucht** einen — der Arbeiter soll nicht raten
  müssen, was er kostenpflichtig tun darf
- ein Erzeugungsauftrag darf **keinen** haben, sonst stünde er dort folgenlos
  daneben und führte beim Lesen in die Irre
- Bestandszeilen wurden auf `lanczos` gesetzt: keine Annahme, sondern die
  einzige Möglichkeit, die es bis dahin gab

**Arbeiter** (`worker/src/fal.ts`): Anmeldung bei `queue.fal.run`, dann
Nachfragen bis `COMPLETED`, dann Ergebnis holen. Das Bild geht als Base64-Data-
URI hinaus, damit nichts öffentlich liegen muss. Ausgabeformat PNG statt der
Voreinstellung JPEG — die ganze Kette ist verlustfrei, und JPEG würde am Ende
Kompressionsspuren hineintragen.

Die Folge-Adressen werden **aus der Antwort übernommen**, nicht selbst
zusammengebaut: fal legt Status und Ergebnis unter einem anderen Pfad ab als dem
des Modells, und genau daran scheitern Anbindungen regelmäßig.

**Oberfläche**: Das Menü auf der Ergebniskachel hat jetzt zwei Gruppen mit
Trennstrich — „Rechnen · kostet nichts" und „KI · rekonstruiert Details" mit dem
Preis rechts an jeder Zeile. Der Preis steht **vor** dem Klick da, nicht in
einer Bestätigung danach.

## Sicherheit

Der Arbeiter lädt am Schluss eine Adresse herunter, die aus einer **fremden
Antwort** stammt. Ohne Prüfung wäre das ein Weg, ihn beliebige Adressen abrufen
zu lassen — auch `http://127.0.0.1:8317`, wo der Bild-Proxy mitsamt Token
lauscht. `hostErlaubt()` lässt nur `https` auf fal-Domains durch.

Diese Funktion ist die einzige mit einem Test (`worker/src/fal.test.ts`,
`npm test`), weil ein zu großzügiger Eintrag in der Hostliste harmlos aussieht
und beim Ausprobieren nie auffällt: Der gute Fall funktioniert weiter. Der Test
wurde durch Mutation geprüft — mit `return true` statt der Hostprüfung wird er
rot.

`FAL_KEY` liegt in `worker/.env` und **nicht** bei Vercel. In der
Cloud-Umgebung stünde er jeder Server-Route offen; auf dem PC kennt ihn nur
dieser eine Prozess. Er ist außerdem in `ohneGeheimnis()` aufgenommen, damit er
nie in einer Fehlermeldung landet.

Der Schlüssel ist **freiwillig**: Fehlt er, laufen Erzeugen und rechnerisches
Vergrößern unverändert weiter. Es scheitert nur der eine Auftragstyp, der ihn
braucht — mit einem Satz, der sagt, wohin er gehört.

## Was Mark wissen muss

- Bei der KI-Vergrößerung **verlässt das Bild den PC**. Beim Rechnen nicht.
- Steht **lesbare Schrift** im Bild (Schilder, Verpackungen), erfinden solche
  Modelle Pseudo-Buchstaben. Bei Filmbildern selten ein Thema.
- fal rechnet nach Megapixeln ab. Ob nach Ein- oder Ausgang, war nicht zu
  belegen — die Preise im Menü rechnen den teureren Fall.

## Was Critic gefunden hat — und was daraus wurde

Unabhängig geprüft am 02.09.2026, vor der Abgabe. Zwei Blocker, drei
Wichtige, sechs Kleinere. Bemerkenswert war der Befund über allen Befunden:
**jeder schwere Punkt saß genau dort, wo die neue Datei vom Muster der Datei
daneben abwich.**

| Muster im Haus | wo es steht | war in `fal.ts` |
|---|---|---|
| `AbortSignal.any([signal, frist])` | `proxy.ts:76` | `signal ?? timeout` |
| Content-Type und Länge prüfen | `supabase.ts:194`, `proxy.ts:113` | fehlte |
| Bezahltes vor dem Neuversuch festhalten | `abarbeiten.ts` (`fortschrittMerken`) | fehlte |

**Blocker 1 — Anfragen ohne Zeitgrenze.** `signal ?? AbortSignal.timeout(...)`
heißt: Sobald ein Signal übergeben wird, ist die Zeitgrenze weg — und im
Dauerbetrieb wird immer eines übergeben. Ein stumm gewordener TCP-Strom hätte
den Arbeiter unbegrenzt eingefroren. Behoben mit `AbortSignal.any`. (Das war
schon korrigiert, als der Befund kam.)

**Blocker 2 — ein Auftrag konnte dreimal bezahlt werden.** Der Punkt, an dem
Geld fließt, ist das Absenden. Danach führte *jeder* Fehler zurück auf `queued`
und der nächste Durchgang schickte einen neuen, kostenpflichtigen Auftrag:
Zeitablauf, misslungenes Hochladen, eine einzelne 5xx-Antwort beim Nachfragen,
ein Neustart durch `node --watch`, zweimal `Strg+C` (das den Versuchszähler
sogar senkt — die Grenze griff dort gar nicht).

Behoben mit der Spalte `external_ref`: Die Auftragsnummer wird unmittelbar nach
dem Absenden festgehalten, vor dem ersten Warten. Ein Neuversuch fragt zuerst
dort nach; nur bei HTTP 404 (bei fal ist nichts mehr da) läuft es neu — eine
Feststellung, keine Annahme.

Mein Kommentar in `abarbeiten.ts` hatte es falsch begründet: „Beide Wege liefern
genau ein Bild, deshalb kein Fortschreiben." Das ist die falsche Größe.
`fortschrittMerken` schützt nicht vor mehreren Bildern, sondern davor,
Bezahltes zweimal zu bezahlen. Beim Vergrößern gibt es dasselbe Bezahlte, es
heißt nur `request_id` statt `result_path`.

**Wichtig 3 — das Ergebnis wurde nicht geprüft.** Eine HTML-Fehlerseite des CDN
mit HTTP 200 wäre als `0.png` in der Ablage gelandet, der Auftrag stünde auf
„fertig", die Kachel wäre kaputt und ohne Fehlertext — bezahlt trotzdem. Jetzt
werden Content-Type, Länge und PNG-Kennung geprüft.

**Wichtig 11 — Menü und Bestätigung widersprachen sich, 200 ms auseinander.**
Das Menü nannte für 4× „ca. 2 ct", die Bestätigung für jeden Faktor „rund einen
halben Cent". Beide lesen jetzt aus `src/lib/upscaling.ts`.

**Wichtig 12 — „Erneut einreihen" war der eine Klick, der ungefragt zahlte.**
Keine Rückfrage, kein Preis, und `attempts: 0` — bei einem gescheiterten
KI-Auftrag bis zu drei weitere Läufe. Jetzt eine Rückfrage mit Preis, aber nur
bei `seedvr2`.

**Kleiner:** Umleitungen umgingen `hostErlaubt` (jetzt `redirect: 'manual'` mit
erneuter Prüfung je Sprung) · Zuhörer-Leck in `warten()` (bis zu 150 an einem
Signal, Node meldete eine Warnung) · ein Abbruch beim Lesen des Antwortrumpfs
kam als `TypeError` statt `AbortError` durch und hätte einen Versuch verbrannt ·
`pruefen.ts` druckte bei HTTP 400 oder 500 ein grünes `[ok]` — ein Messkanal,
der bei kaputtem Schlüssel grün meldet, ist schlimmer als keiner · `upscaler`
wird jetzt in der Warteschlange angezeigt statt der mitgeführten `model`-Spalte ·
eigene Zeitgrenze `FAL_TIMEOUT_MS`, damit ein kleineres `REQUEST_TIMEOUT_MS`
für den Proxy nicht still die Geduld gegenüber fal kürzt · der Abbruchtext sagt
jetzt, dass ein gestarteter KI-Lauf trotzdem berechnet wird.

**Bestätigt in Ordnung:** die vier CHECK-Schranken sind widerspruchsfrei und
lückenlos, die Rückfüllung läuft vor dem Hinzufügen · `hostErlaubt()` hält auch
gegen `https://queue.fal.run@boese.de/` und `fal.media.angreifer.de` · der
FAL_KEY landet in keiner Meldung, keinem Log und keiner Datenbankzeile · die
Warteschleife hängt nicht und bricht nicht zu früh ab.

## Zweites KI-Verfahren: Crystal (Clarity AI) — 02.09.2026

Auf Marks Wunsch dazugebaut, `fal-ai/crystal-upscaler`. Statt eines zweiten
if-Zweigs eine Modelltabelle in `fal.ts`: Die Modelle sprechen nicht dieselbe
Sprache — SeedVR2 will `upscale_factor` und liefert `image`, Crystal will
`scale_factor` und liefert `images` als Liste. Der Ablauf drumherum ist gleich
und steht nur einmal da. Crystal hat zusaetzlich `creativity` (0 bis 10); wir
fahren auf 0, also nah am Original.

### Die Preise, gemessen statt geschaetzt

Beide auf demselben Bild (1122x1402, Faktor 2), Preis aus dem Guthaben bei
fal.ai vorher und nachher:

| Verfahren | Kosten | Ergebnis | je Megapixel |
|---|---|---|---|
| SeedVR2 | **0,7 ct** | 2256x2816 | ~$0,0011 |
| Crystal | **9,6 ct** | 2244x2804 | ~$0,0152 |

**Crystal kostet das Vierzehnfache.** Im Menue stand vorher fuer beide
„ca. 0,5 ct" — eine aus der Recherche uebernommene Zahl, die fuer Crystal um
das Neunzehnfache danebenlag. Bei einem Preis, der vor dem Klick steht, ist das
eine falsche Auskunft. `KI_PREIS` ist jetzt je Verfahren.

Die Werte fuer 3x und 4x sind hochgerechnet (Flaeche waechst quadratisch), nicht
gemessen. Mit einem Messpunkt laesst sich nicht entscheiden, ob Crystal
ueberhaupt nach Megapixeln abrechnet oder pauschal je Bild.

### Zwei Fallstricke, die dabei aufgefallen sind

**fal bucht verzoegert ab.** SeedVR2 zeigte unmittelbar nach dem Lauf noch
0,00 Cent; der Abzug kam rund eine Minute spaeter. Wer sofort nachmisst, misst
falsch — und haette hier faelschlich „kostenlos" notiert.

**Das Format kann wechseln.** Die Bildpruefung akzeptiert jetzt PNG, JPEG und
WEBP statt nur PNG. Google lieferte am selben Tag auf eine Anfrage, die PNG
erwarten liess, ein JPEG. Ein Anbieter, der das Format wechselt, soll keinen
bezahlten Auftrag zum Scheitern bringen.

Das Menue wird aus der Verfahrensliste erzeugt statt dreimal abgeschrieben —
beim zweiten KI-Verfahren waere sonst genau die Kopie entstanden, an der Preis
und Beschriftung auseinanderdriften (Critic-Befund 11).

## Offen

- **Noch nicht gegen die echte API gemessen.** Es fehlt der Schlüssel: Konto auf
  fal.ai anlegen, Guthaben aufladen, `FAL_KEY` in `worker/.env` eintragen. Dann
  `npm run pruefen` (kostet nichts) und ein echter 2×-Lauf.
- Crystals Preis fuer 3x und 4x ist hochgerechnet, nicht gemessen.
- Ob Crystals `creativity` ueber 0 lohnt, ist ungeprueft. Waere eine
  Einstellung in der Oberflaeche, wenn Mark es will.
- **Ungemessen: die Größe des Datenrumpfs.** Das PNG geht als Base64 im
  JSON-Rumpf hinaus — bei einem 1536×1024-Bild sind das 3 bis 5,5 MB. Fals
  Grenze ist nicht belegt. Das ist der eine Punkt, der beim ersten echten Lauf
  mit dem **größten** vorhandenen Quellbild auszuprobieren ist. Scheitert es,
  scheitert es für jedes große Bild, und dann wäre fals Datei-Ablage der Weg.
- Die Oberfläche ist nicht durchgeklickt — der Zugang ist angemeldet. Zu prüfen
  bleiben: das zweigeteilte Menü, die Rückfrage bei „Erneut einreihen" und ob
  in der Zeile eines Vergrößerungsauftrags jetzt „KI (SeedVR2)" steht.
