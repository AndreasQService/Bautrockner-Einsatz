---
description: Verbindlicher Workflow für sichere Code-Updates, Verifikation und manuelles Deployment im QTool
---

Dieser Workflow ist verbindlich für alle zukünftigen Modifikationen am QTool. Er stellt sicher, dass Code-Änderungen gründlich geprüft und kontrolliert live geschaltet werden, da automatische Vercel-Deployments per Git-Push deaktiviert sind.

## 1. Lokale Entwicklung & lokales Testen
* Setzen Sie die gewünschte Funktion oder Layout-Änderung in der entsprechenden Komponente um.
* Starten Sie die Entwicklungsumgebung mit dem System-Befehl:
  `Start-QTool` bzw. `dev-Qtool`
* Prüfen Sie das Verhalten der App ausführlich im lokalen Browser (Standardport `5180`).

## 2. Lokale Qualitätsprüfung (Syntax & Tests)
Vor jedem Commit und Deployment müssen folgende Prüfungen durchgeführt werden:

* **Syntax-Validierung (Hauptkomponente):**
  `node check_syntax.js src/components/DamageForm.jsx`
* **Syntax-Validierung (PDF-Dokumentation):**
  `node check_syntax.js src/components/pdf/DamageReportDocument.jsx`
* **Automatisierte Playwright-Tests:**
  `npm run test` (Alle Tests müssen erfolgreich durchlaufen!)

## 3. Git-Sicherung (Push ohne Live-Auswirkung)
Sichern Sie den verifizierten Stand in Git und pushen Sie ihn auf GitHub. Dies dient dem Backup und der Versionskontrolle, hat jedoch dank der getrennten Vercel-Git-Verbindung **keinen** Einfluss auf die Live-Anwendung:
`git add .`
`git commit -m "[Präzise Beschreibung der Änderung]"`
`git push origin main`

## 4. Test-Build auf Vercel (Optional, empfohlen)
Erstellen Sie ein temporäres Preview-Deployment, um den Build-Prozess auf den Vercel-Servern zu testen und eine Vorschau-URL zu erhalten:
`vercel`

## 5. Live-Schaltung (Manuelles Produktions-Deployment)
Erst wenn die lokalen Prüfungen und ggf. das Preview-Deployment fehlerfrei sind, schalten Sie die Änderungen für alle Anwender live:
`vercel --prod`

