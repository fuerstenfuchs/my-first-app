import '@testing-library/jest-dom'
import { vi } from 'vitest'

/**
 * EIN TESTDOPPEL FÜR `sonner`, DAS JEDE METHODE KENNT.
 *
 * DER FALL, DER DAZU GEFÜHRT HAT (07.09.2026): Neuer Code rief `toast.info(…)`.
 * Zwei Testdoppel kannten nur `error` und `success` — der Aufruf warf, der
 * Auftrag wurde nie eingereiht, und der Test meldete „erwartet: mindestens
 * einmal aufgerufen". Der Fehler zeigte damit auf den Auftrag, obwohl er im
 * Doppel lag.
 *
 * `info` in zwei Dateien nachzutragen hätte das Problem nur verschoben. Dieses
 * Doppel legt für JEDE abgefragte Eigenschaft eine Attrappe an — eine fehlende
 * Methode kann hier nie wieder werfen.
 *
 * Ein Test, der auf eine bestimmte Meldung prüfen will, ersetzt es weiterhin
 * mit einem eigenen `vi.mock('sonner', …)`; das gewinnt gegen diese Vorgabe.
 */
vi.mock('sonner', () => {
  const attrappen = new Map<string, ReturnType<typeof vi.fn>>()
  const toast = new Proxy({} as Record<string, unknown>, {
    get(_ziel, name: string) {
      if (!attrappen.has(name)) attrappen.set(name, vi.fn())
      return attrappen.get(name)
    },
  })
  return { toast, Toaster: () => null }
})
