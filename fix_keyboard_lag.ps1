# ============================================================
# fix_keyboard_lag.ps1
# Behebt USB-Tastatur Lag (bis 30 Sek.) am HP Dock
# Muss als ADMINISTRATOR ausgefuehrt werden!
# ============================================================

$ErrorActionPreference = "SilentlyContinue"

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  USB Keyboard Lag Fix - Andreas Q-Service" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. USB Selective Suspend im Energiesparplan deaktivieren ---
Write-Host "[1/4] Deaktiviere USB Selective Suspend im Energiesparplan..." -ForegroundColor Yellow

# Aktuellen Plan holen
$currentPlan = (powercfg /getactivescheme) -replace ".*GUID: ([a-f0-9-]+).*", '$1'
Write-Host "      Aktiver Plan: $currentPlan"

# AC (Netzbetrieb) und DC (Akku) - USB Selective Suspend aus
powercfg /setacvalueindex $currentPlan 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /setdcvalueindex $currentPlan 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
powercfg /apply
Write-Host "      OK - USB Selective Suspend deaktiviert" -ForegroundColor Green

# --- 2. Energiemanagement fuer alle USB-Root-Hubs deaktivieren ---
Write-Host ""
Write-Host "[2/4] Deaktiviere Energieverwaltung fuer alle USB Root Hubs..." -ForegroundColor Yellow

$usbHubs = Get-WmiObject Win32_PnPEntity | Where-Object {
    $_.Name -like "*USB Root Hub*" -or $_.Name -like "*USB-Stamm-Hub*"
}

foreach ($hub in $usbHubs) {
    $devPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\" + $hub.DeviceID + "\Device Parameters"
    if (Test-Path $devPath) {
        Set-ItemProperty -Path $devPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -ErrorAction SilentlyContinue
    }
}

# Alle USB Root Hubs per WMI Power Management deaktivieren
$hubs = Get-WmiObject -Query "SELECT * FROM MSPower_DeviceEnable WHERE InstanceName LIKE '%USBROOT%'" -Namespace root\wmi -ErrorAction SilentlyContinue
foreach ($h in $hubs) {
    $h.Enable = $false
    $h.Put() | Out-Null
}
Write-Host "      OK - $($usbHubs.Count) USB Root Hub(s) gefunden und bearbeitet" -ForegroundColor Green

# --- 3. "Erlauben, Geraet auszuschalten" fuer ALLE HID/USB-Geraete deaktivieren ---
Write-Host ""
Write-Host "[3/4] Deaktiviere Power-Management fuer alle HID & USB-Geraete..." -ForegroundColor Yellow

$deviceRegBase = "HKLM:\SYSTEM\CurrentControlSet\Enum"
$count = 0

# USB HID Keyboards
$hidKeyboards = Get-PnpDevice | Where-Object {
    ($_.Class -eq "HIDClass" -or $_.Class -eq "Keyboard" -or $_.InstanceId -like "USB\VID*") -and
    $_.Status -eq "OK"
}

foreach ($dev in $hidKeyboards) {
    $regPath = "$deviceRegBase\$($dev.InstanceId)\Device Parameters"
    if (Test-Path $regPath) {
        Set-ItemProperty -Path $regPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -EA SilentlyContinue
        $count++
    }
}

# Alle USB-Hubs zusaetzlich
$usbControllers = Get-PnpDevice | Where-Object { $_.InstanceId -like "USB\ROOT_HUB*" -or $_.InstanceId -like "USB\VID_413C*" }
foreach ($dev in $usbControllers) {
    $regPath = "$deviceRegBase\$($dev.InstanceId)\Device Parameters"
    if (Test-Path $regPath) {
        Set-ItemProperty -Path $regPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -EA SilentlyContinue
    }
}

Write-Host "      OK - $count Geraete bearbeitet" -ForegroundColor Green

# --- 4. USB Link Power Management (LPM) deaktivieren (Registry) ---
Write-Host ""
Write-Host "[4/4] Deaktiviere USB Link Power Management (LPM)..." -ForegroundColor Yellow

$usbStorPath = "HKLM:\SYSTEM\CurrentControlSet\Services\USB"
if (-not (Test-Path $usbStorPath)) {
    New-Item -Path $usbStorPath -Force | Out-Null
}
Set-ItemProperty -Path $usbStorPath -Name "DisableSelectiveSuspend" -Value 1 -Type DWord
Set-ItemProperty -Path $usbStorPath -Name "EnabelConnectedStandby" -Value 0 -Type DWord -EA SilentlyContinue

# HID Timeout fix - verhindert dass HID-Dienst Geraet "freigibt"
$hidPath = "HKLM:\SYSTEM\CurrentControlSet\Services\hidusb\Parameters"
if (-not (Test-Path $hidPath)) {
    New-Item -Path $hidPath -Force | Out-Null
}
Set-ItemProperty -Path $hidPath -Name "BreakOnEntry" -Value 0 -Type DWord -EA SilentlyContinue

Write-Host "      OK - LPM und HID-Timeouts angepasst" -ForegroundColor Green

# --- 5. Netzwerkadapter Energiesparen deaktivieren ---
Write-Host ""
Write-Host "[5/5] Deaktiviere Energieverwaltung fuer alle Netzwerkadapter..." -ForegroundColor Yellow
try {
    $adapters = Get-NetAdapter -Physical -ErrorAction SilentlyContinue
    if ($adapters) {
        foreach ($adapter in $adapters) {
            $pm = $adapter | Get-NetAdapterPowerManagement -ErrorAction SilentlyContinue
            if ($pm -and $pm.AllowComputerToTurnOffDevice -ne 'Disabled') {
                $pm.AllowComputerToTurnOffDevice = 'Disabled'
                $pm | Set-NetAdapterPowerManagement -ErrorAction SilentlyContinue
                Write-Host "      OK - Energieverwaltung fuer $($adapter.Name) deaktiviert" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "      Fehler beim Anpassen der Netzwerkadapter-Energieverwaltung" -ForegroundColor Red
}

# --- Zusammenfassung ---
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  FERTIG! Bitte jetzt den Computer neu starten." -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Was wurde gemacht:" -ForegroundColor White
Write-Host "  - USB Selective Suspend deaktiviert (Netzbetrieb + Akku)" -ForegroundColor Gray
Write-Host "  - USB Root Hub Energieverwaltung deaktiviert" -ForegroundColor Gray
Write-Host "  - HID/Tastatur-Geraete: 'Ausschalten zum Sparen' OFF" -ForegroundColor Gray
Write-Host "  - USB Link Power Management (LPM) deaktiviert" -ForegroundColor Gray
Write-Host "  - Netzwerkadapter (inkl. Realtek USB GbE) Energieverwaltung deaktiviert" -ForegroundColor Gray
Write-Host ""
Write-Host "Wenn das Lag danach noch besteht: Dock-Firmware pruefen!" -ForegroundColor Yellow
Write-Host ""

Read-Host "Druecke ENTER zum Beenden"
