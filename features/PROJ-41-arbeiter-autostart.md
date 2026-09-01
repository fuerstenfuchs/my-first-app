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

## Offen

- Der Autostart ist eingerichtet, aber noch nicht durch einen echten Neustart des
  PCs bestätigt. Das zeigt sich beim nächsten Hochfahren.
- Die Anzeige „Arbeiter läuft" hat noch niemand in der App gesehen — sie braucht
  Marks Zugang.
