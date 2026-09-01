@echo off
rem Umlaute im Fenster richtig darstellen
chcp 65001 >nul
rem Startet den Bild-Arbeiter fuer Prompt Tresor.
rem
rem Dieselbe Datei taugt fuer beides: zum Doppelklicken und fuer den
rem Autostart-Ordner von Windows (Win+R, shell:startup).
rem
rem --watch: Aendert sich der Code, startet er von selbst neu.

cd /d "%~dp0"

if not exist ".env" (
  echo Es fehlt die Datei .env im Ordner worker.
  echo Kopiere .env.example nach .env und trage die Werte ein.
  pause
  exit /b 1
)

title Prompt Tresor - Bild-Arbeiter
echo Arbeiter startet. Dieses Fenster offen lassen.
echo Beenden mit Strg+C.
echo.

npm start
pause
