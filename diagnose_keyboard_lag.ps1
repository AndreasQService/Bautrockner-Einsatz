# ============================================================
# diagnose_keyboard_lag.ps1
# Analysiert USB/HID Events der letzten 15 Minuten
# Als Administrator ausfuehren!
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$since = (Get-Date).AddMinutes(-15)

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Keyboard Lag Diagnose - Letzte 15 Minuten" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# --- USB Errors im System-Log ---
Write-Host ""
Write-Host "[1] USB-Fehler im System-EventLog:" -ForegroundColor Yellow
$usbEvents = Get-WinEvent -LogName System -ErrorAction SilentlyContinue |
    Where-Object { $_.TimeCreated -gt $since -and
        ($_.ProviderName -like "*USB*" -or $_.ProviderName -like "*HID*" -or $_.Message -like "*USB*") -and
        $_.LevelDisplayName -in @("Error","Warning") }

if ($usbEvents.Count -eq 0) {
    Write-Host "   Keine USB-Fehler gefunden" -ForegroundColor Gray
} else {
    $usbEvents | Select-Object TimeCreated, LevelDisplayName, ProviderName, Id, Message |
        Format-Table -AutoSize -Wrap
}

# --- Kernel-PnP Events (Geraet getrennt/verbunden) ---
Write-Host ""
Write-Host "[2] PnP Geraete-Events (Verbinden/Trennen):" -ForegroundColor Yellow
$pnpEvents = Get-WinEvent -LogName "System" -ErrorAction SilentlyContinue |
    Where-Object { $_.TimeCreated -gt $since -and $_.ProviderName -eq "Microsoft-Windows-Kernel-PnP" }

if ($pnpEvents.Count -eq 0) {
    Write-Host "   Keine PnP-Events gefunden" -ForegroundColor Gray
} else {
    $pnpEvents | Select-Object TimeCreated, Id, Message |
        Format-Table -AutoSize -Wrap | Select-Object -First 20
}

# --- HID Verbose Log aktivieren (fuer naechsten Lag) ---
Write-Host ""
Write-Host "[3] Installierte HID-Filter-Treiber (potenzielle Stoerer):" -ForegroundColor Yellow
$hidFilters = @()
$hidFilters += (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{745a17a0-74d3-11d0-b6fe-00a0c90f57da}" -Name UpperFilters -EA SilentlyContinue).UpperFilters
$hidFilters += (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{745a17a0-74d3-11d0-b6fe-00a0c90f57da}" -Name LowerFilters -EA SilentlyContinue).LowerFilters

if ($hidFilters -and $hidFilters.Count -gt 0) {
    Write-Host "   HID Filter gefunden:" -ForegroundColor Red
    $hidFilters | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
} else {
    Write-Host "   Keine HID-Filter-Treiber" -ForegroundColor Green
}

# --- Keyboard Filter Treiber ---
Write-Host ""
Write-Host "[4] Keyboard-Filter-Treiber:" -ForegroundColor Yellow
$kbFilters = @()
$kbFilters += (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96b-e325-11ce-bfc1-08002be10318}" -Name UpperFilters -EA SilentlyContinue).UpperFilters
$kbFilters += (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e96b-e325-11ce-bfc1-08002be10318}" -Name LowerFilters -EA SilentlyContinue).LowerFilters

if ($kbFilters -and $kbFilters.Count -gt 0) {
    Write-Host "   Keyboard Filter gefunden:" -ForegroundColor Red
    $kbFilters | ForEach-Object { Write-Host "   - $_" -ForegroundColor Red }
} else {
    Write-Host "   Keine Keyboard-Filter-Treiber" -ForegroundColor Green
}

# --- Aktuell verbundene USB-Geraete ---
Write-Host ""
Write-Host "[5] Aktuell verbundene USB HID Geraete:" -ForegroundColor Yellow
Get-PnpDevice | Where-Object {
    ($_.Class -eq "HIDClass" -or $_.Class -eq "Keyboard") -and $_.Status -eq "OK"
} | Select-Object FriendlyName, InstanceId, Status | Format-Table -AutoSize

# --- Modern Standby Typ pruefen ---
Write-Host ""
Write-Host "[6] Surface Energiemodus (Modern Standby):" -ForegroundColor Yellow
$standbyInfo = powercfg /a 2>&1
if ($standbyInfo -match "Modern Standby|S0 Low Power") {
    Write-Host "   MODERN STANDBY aktiv -> kann USB-Lag verursachen!" -ForegroundColor Red
    Write-Host "   Typ: $($standbyInfo | Select-String 'S0' | Select-Object -First 1)" -ForegroundColor Red
} else {
    Write-Host "   Normaler Standby (S3)" -ForegroundColor Green
}

# --- HP Dock spezifisch ---
Write-Host ""
Write-Host "[7] HP Dock / USB-Hub Geraete:" -ForegroundColor Yellow
Get-PnpDevice | Where-Object {
    $_.FriendlyName -like "*HP*" -or $_.FriendlyName -like "*Dock*" -or
    $_.FriendlyName -like "*USB Hub*" -or $_.FriendlyName -like "*USB-Hub*"
} | Select-Object FriendlyName, Status, InstanceId | Format-Table -AutoSize

# --- Output speichern ---
$outFile = "C:\QTool\keyboard_lag_report_$(Get-Date -Format 'yyyyMMdd_HHmmss').txt"
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  Speichere Report nach: $outFile" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Script nochmal als Text ausgeben
& $PSCommandPath *>&1 | Out-File $outFile -Encoding UTF8 -ErrorAction SilentlyContinue
Write-Host "  Bitte den Report-Inhalt mitschicken!" -ForegroundColor Yellow
Write-Host ""
Read-Host "Druecke ENTER zum Beenden"
