# USB Controller Energieverwaltung deaktivieren
# "Computer darf Gerät ausschalten" = AUS fuer alle USB Controller

$usbControllers = Get-PnpDevice -Class USB | Where-Object { $_.Status -eq 'OK' }

$count = 0
foreach ($device in $usbControllers) {
    $instanceId = $device.InstanceId
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters"
    
    if (Test-Path $regPath) {
        try {
            Set-ItemProperty -Path $regPath -Name "AllowIdleIrpInD3" -Value 0 -Type DWord -ErrorAction SilentlyContinue
            $count++
        } catch {}
    }
    
    # Ueber WMI den Power-Flag setzen
    $wmiPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters\Power"
    if (Test-Path $wmiPath) {
        try {
            Set-ItemProperty -Path $wmiPath -Name "IdleIsPowerSave" -Value 0 -Type DWord -ErrorAction SilentlyContinue
        } catch {}
    }
}

# Alle USB Root Hubs: Energiesparen deaktivieren
$rootHubs = Get-PnpDevice | Where-Object { $_.FriendlyName -like "*USB Root Hub*" -or $_.FriendlyName -like "*USB-Stammhub*" }

foreach ($hub in $rootHubs) {
    $instanceId = $hub.InstanceId
    $regPath = "HKLM:\SYSTEM\CurrentControlSet\Enum\$instanceId\Device Parameters"
    if (Test-Path $regPath) {
        try {
            Set-ItemProperty -Path $regPath -Name "EnhancedPowerManagementEnabled" -Value 0 -Type DWord -ErrorAction SilentlyContinue
            $count++
        } catch {}
    }
}

Write-Host "Fertig: $count USB-Geraete konfiguriert. Bitte neu starten."
