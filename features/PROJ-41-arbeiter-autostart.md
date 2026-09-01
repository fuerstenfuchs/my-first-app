# PROJ-41: Arbeiter startet selbst, Lebenszeichen in der Warteschlange

## Status: In Review
**Created:** 2026-09-01
**Anlass:** Mark: „Muss ich diesen Arbeiter immer selber neu starten?"

## Die Antwort war zweimal ja — jetzt zweimal nein

**Nach dem Hochfahren.** Eine Verknüpfung im Autostart-Ordner von Windows zeigt
auf `worker/arbeiter-starten.cmd` und öffnet ein minimiertes Fenster. Beim
Anlegen zeigte sich: EasyCLIProxyAPI liegt ohnehin schon im Autostart — beide
kommen jetzt zusammen hoch.

Wieder loswerden: `Win+R`, `shell:startup`, Verknüpfung löschen.

**Nach einer Code-Änderung.** `npm start` läuft jetzt mit `node --watch`. Nachgemessen:
Eine Änderung an einer Datei löst einen Neustart aus (zwei Startmeldungen im
selben Lauf). Damit entfällt der Handgriff, dessen Vergessen schon einmal einen
Vergrößerungsauftrag dreimal ans Bildmodell geschickt und verbrannt hat.

## Neu: Man sieht, ob er läuft

Die Warteschlange zeigt oben „Arbeiter läuft" (grün) oder „Arbeiter zuletzt vor
… " (bernstein). Der Leerzustand nennt zusätzlich den Startbefehl, wenn der
Arbeiter gerade weg ist.

Der Arbeiter meldet sich bei jedem Durchgang, also alle fünf Sekunden; ab
dreißig Sekunden ohne Meldung gilt er als weg.

**Der Zeitstempel kommt von der Datenbank, nicht vom PC.** In der ersten Fassung
schickte der Arbeiter `new Date()` mit — und die Anzeige sagte „zuletzt gesehen
vor -34 Sekunden", weil die PC-Uhr vorgeht. Jetzt stempelt die Datenbank
(`default now()`), und eine Sicht rechnet die Zeitspanne dort aus, wo beide Werte
von derselben Uhr stammen.

## Nebenbei behoben

**Ein nicht erreichbarer Proxy verbrennt keinen Versuch mehr.** Das war vorher
egal, wird durch den Autostart aber zur Regel: Arbeiter und Proxy starten
gleichzeitig, und der Arbeiter ist schneller da. Drei Anläufe in den ersten
Sekunden hätten einen Auftrag als endgültig gescheitert abgelegt. Jetzt bleibt er
liegen, bis der Proxy antwortet.

**Zeilenenden der Startdatei.** Mit Unix-Zeilenenden geschrieben, meldete
`cmd.exe` nur „Der Befehl ist entweder falsch geschrieben oder konnte nicht
gefunden werden". Jetzt CRLF, und `.gitattributes` hält es so — sonst hätte Git
es beim nächsten Auschecken wieder zerstört.

## Sparsamer Takt (nachgereicht am selben Tag)

Mark: „Kann sein, dass ich ihn den ganzen Tag nicht brauche."

Gemessen, was der starre Fünf-Sekunden-Takt kostet: Ein Leerdurchgang sind drei
Anfragen und 2209 Bytes. Mal 17.280 Durchgänge am Tag ergibt **36 MB täglich,
1092 MB im Monat — 21 Prozent des Supabase-Kontingents**, nur fürs Nachfragen
ins Leere.

Jetzt passt sich der Takt der Lage an:

| Ruhe seit | Abstand |
|---|---|
| unter 1 Minute | 5 s |
| bis ~6 Minuten | 15 s |
| bis ~35 Minuten | 30 s |
| danach | 60 s |

Beim ersten Auftrag fällt er sofort auf fünf Sekunden zurück. Dazu läuft das
Aufräumen nur noch einmal pro Minute statt bei jedem Durchgang, und das
Lebenszeichen hängt nicht mehr am Auftragstakt (alle 20 Sekunden) — sonst hätte
die Anzeige ihn für weg gehalten, obwohl er nur sparsam war. Die Schwelle in der
App steht entsprechend auf 60 Sekunden.

**Ergebnis: 5 MB statt 36 MB am Tag — 86 Prozent weniger, 3 statt 21 Prozent des
Kontingents.** Der Preis: Nach langer Ruhe dauert es höchstens eine Minute, bis
er den ersten Auftrag bemerkt.

## Was laufen muss, damit Bilder entstehen

Ausdrücklich **nicht** Claude Code — im ganzen Arbeiter kommt weder „claude" noch
„anthropic" vor, er spricht nur mit zwei Adressen: dem Bild-Proxy auf
`127.0.0.1` und Supabase.

Nachgewiesen am 01.09.2026: Auftrag `03442304` wurde über die Autostart-Datei
abgeholt und in 19 Sekunden erzeugt, ohne jede Beteiligung von Claude Code.

Nötig sind: der PC an, EasyCLIProxyAPI (Autostart), der Arbeiter (Autostart) und
eine Internetverbindung. Ist der PC aus, bleiben Aufträge liegen und werden
abgearbeitet, sobald er wieder läuft.

## Offen

- Der Autostart ist eingerichtet, aber noch nicht durch einen echten Neustart des
  PCs bestätigt. Das zeigt sich beim nächsten Hochfahren.
- Die Anzeige „Arbeiter läuft" hat noch niemand in der App gesehen — sie braucht
  Marks Zugang.
