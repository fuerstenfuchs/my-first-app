---
name: projekt-eigener-proxy
description: Prompt Trésor ruft KI-Analysen bevorzugt über Marks lokale CLIProxyAPI (127.0.0.1:8317) aus dem Browser statt über bezahlte Server-Routen
metadata:
  type: project
---

Seit dem 03.09.2026 laufen die sieben Bildanalysen bevorzugt über Marks eigene
CLIProxyAPI auf `http://127.0.0.1:8317` — aus dem BROWSER, nicht vom Server.
Die Server-Routen (`/api/analyze-*`, Anthropic/OpenAI mit bezahlten Schlüsseln)
sind nur noch der Rückfall.

**Why:** Der Proxy bedient Marks vorhandene Abos und ist für ihn kostenlos. Er
läuft aber auf seinem PC — ein Vercel-Server erreicht `127.0.0.1` nie. Der
Browser ist der einzige Teil der App auf demselben Gerät. Mark hat diesen Weg
ausdrücklich gewählt.

**How to apply:** Neue KI-Aufrufe, die im Browser ein Bild oder einen Text zur
Hand haben, gehen über `analysiere()` aus `src/hooks/use-analyse.ts` — nicht
direkt an eine Route. Die Proxy-Einstellung (Adresse, Schlüssel, Modell) liegt
bewusst in `localStorage` (`tresor.proxy`), nie in Supabase: sie ist
rechnergebunden, und der Schlüssel gehört nicht in die Cloud. Ein Rückfall auf
die bezahlte Route muss immer sichtbar gemeldet werden — still zurückfallen
heißt, dass Mark erst auf der Rechnung merkt, dass sein Proxy aus war.
Den Zugangsschlüssel trägt Mark selbst ein; nie einen eintragen, auch nicht zum
Testen.
