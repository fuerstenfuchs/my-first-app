# Arbeiter — Einrichtung

Nach dem Klonen einmalig:

```bash
cd worker
npm install
cp .env.example .env     # dann ausfüllen
npm run pruefen          # prüft die Einrichtung, erzeugt kein Bild
npm start
```

`node_modules` liegt bewusst nicht im Repository — `sharp` bringt
plattformabhängige Binärdateien mit, die auf einem anderen Rechner ohnehin
nicht passen würden.
