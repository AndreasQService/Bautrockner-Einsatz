# ============================================================
# QTool Fix: USB Keyboard Lag nach Inaktivitaet
# Deaktiviert Energiesparen fuer HID-Geraete (Tastatur/Maus)
# und setzt Bildschirm-Timeout auf 20 Min
# ============================================================

# 1. Bildschirm-Timeout auf 20 Minuten setzen (Netz + Akku)
powercfg -setacvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 1200
powercfg -setdcvalueindex SCHEME_CURRENT SUB_VIDEO VIDEOIDLE 1200
Write-Host "[1] Bildschirm-Timeout: 20 Minuten gesetzt"

# 2. Standby/Sleep deaktivieren (verhindert Modern Standby nach Timeout)
powercfg -setacvalueindex SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0
powercfg -setdcvalueindex SCHEME_CURRENT SUB_SLEEP STANDBYIDLE 0
Write-Host "[2] Standby nach Inaktivitaet: Deaktiviert"

# 3. HID-Geraete (Tastatur, Maus) - Energieverwaltung deaktivieren
$hidDevices = Get-PnpDevice -Class HIDClass | Where-Object { $_.Status -eq 'OK' }
$hidCount = 0
foreach ($device in $hidDevices) {
    $instanceId = $device.InstanceId
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters"
    if (Test-Path $regPath) {
        try {
            Set-ItemProperty -Path $regPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            $hidCount++
        } catch {}
    }
}
Write-Host "[3] HID-Geraete konfiguriert: $hidCount Geraete"

# 4. USB Root Hubs - Energieverwaltung komplett aus
$usbHubs = Get-PnpDevice | Where-Object { 
    $_.FriendlyName -like "*USB*Hub*" -or 
    $_.FriendlyName -like "*USB-Stammhub*" -or
    $_.FriendlyName -like "*USB Root*"
}
$hubCount = 0
foreach ($hub in $usbHubs) {
    $instanceId = $hub.InstanceId
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters"
    if (Test-Path $regPath) {
        try {
            Set-ItemProperty -Path $regPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            Set-ItemProperty -Path $regPath -Name "AllowIdleIrpInD3" -Value 0 -Type DWord -Force -ErrorAction SilentlyContinue
            $hubCount++
        } catch {}
    }
}
Write-Host "[4] USB Hubs konfiguriert: $hubCount Geraete"

# 5. Schema anwenden
powercfg -setactive SCHEME_CURRENT
Write-Host "[5] Energieschema angewendet"

Write-Host ""
Write-Host "FERTIG - Bitte einmal neu starten fuer volle Wirkung."
Read-Host "Druecke Enter zum Schliessen"
