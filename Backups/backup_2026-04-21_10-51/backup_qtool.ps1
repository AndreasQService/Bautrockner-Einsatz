# ═══════════════════════════════════════════════════════════════════
# QTool Automatisches Backup-Skript
# ─────────────────────────────────────────────────────────────────
# Einrichten als automatische Aufgabe:
#   1. Windows-Taste → "Aufgabenplanung" öffnen
#   2. "Einfache Aufgabe erstellen..." → Name: "QTool Backup"
#   3. Auslöser: Täglich um 02:00 Uhr
#   4. Aktion: Programm starten
#      Programm:  powershell.exe
#      Argumente: -ExecutionPolicy Bypass -File "c:\QTool\backup_qtool.ps1"
# ═══════════════════════════════════════════════════════════════════

$ErrorActionPreference = "Stop"
$date = Get-Date -Format "yyyy-MM-dd_HH-mm"
$backupRoot = "c:\QTool\Backups"
$backupDir = "$backupRoot\$date"

Write-Host "=== QTool Backup $date ===" -ForegroundColor Cyan

# .env Datei auslesen
$envPath = "c:\QTool\.env"
if (-not (Test-Path $envPath)) {
    Write-Error ".env Datei nicht gefunden: $envPath"
    exit 1
}

$envVars = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+)\s*$') {
        $envVars[$Matches[1]] = $Matches[2].Trim('"').Trim("'")
    }
}

$supabaseUrl = $envVars['VITE_SUPABASE_URL']
$supabaseKey = $envVars['VITE_SUPABASE_ANON_KEY']

if (-not $supabaseUrl -or -not $supabaseKey) {
    Write-Error "VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY nicht in .env gefunden"
    exit 1
}

# Backup-Ordner erstellen
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
Write-Host "Backup-Ordner: $backupDir" -ForegroundColor Gray

$headers = @{
    "apikey"        = $supabaseKey
    "Authorization" = "Bearer $supabaseKey"
    "Content-Type"  = "application/json"
}

# ── Haupttabelle: damage_reports ───────────────────────────────────
Write-Host "Lade damage_reports... " -NoNewline
try {
    # Erst versuchen mit Soft-Delete Filter (nach SQL-Upgrade)
    $url = "$supabaseUrl/rest/v1/damage_reports?select=*&deleted_at=is.null&order=created_at.desc"
    try {
        $data = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    } catch {
        # Fallback ohne Filter (vor SQL-Upgrade / Spalte existiert noch nicht)
        Write-Host "(Fallback ohne deleted_at Filter) " -NoNewline -ForegroundColor Yellow
        $url = "$supabaseUrl/rest/v1/damage_reports?select=*&order=created_at.desc"
        $data = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    }
    $data | ConvertTo-Json -Depth 20 | Out-File "$backupDir\damage_reports.json" -Encoding UTF8
    Write-Host "$($data.Count) Projekte gesichert" -ForegroundColor Green
} catch {
    Write-Host "FEHLER: $_" -ForegroundColor Red
}

# ── Geräte: devices ────────────────────────────────────────────────
Write-Host "Lade devices... " -NoNewline
try {
    $url = "$supabaseUrl/rest/v1/devices?select=*&order=created_at.desc"
    $data = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $data | ConvertTo-Json -Depth 10 | Out-File "$backupDir\devices.json" -Encoding UTF8
    Write-Host "$($data.Count) Geräte gesichert" -ForegroundColor Green
} catch {
    Write-Host "FEHLER (devices): $_" -ForegroundColor Yellow
}

# ── Audit-Log (letzte 30 Tage) ─────────────────────────────────────
Write-Host "Lade audit_log (30 Tage)... " -NoNewline
try {
    $since = (Get-Date).AddDays(-30).ToString("yyyy-MM-ddTHH:mm:ssZ")
    $url = "$supabaseUrl/rest/v1/damage_reports_audit?select=*&changed_at=gte.$since&order=changed_at.desc"
    $data = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    $data | ConvertTo-Json -Depth 10 | Out-File "$backupDir\audit_log_30d.json" -Encoding UTF8
    Write-Host "$($data.Count) Einträge gesichert" -ForegroundColor Green
} catch {
    Write-Host "FEHLER (audit_log): $_" -ForegroundColor Yellow
}

# ── Backup-Manifest ────────────────────────────────────────────────
$manifest = @{
    backup_date    = $date
    created_at     = (Get-Date).ToString("o")
    supabase_url   = $supabaseUrl -replace "https://([^.]+)\..*", "https://***"
    files          = (Get-ChildItem $backupDir | ForEach-Object { $_.Name })
}
$manifest | ConvertTo-Json | Out-File "$backupDir\manifest.json" -Encoding UTF8

# ── Alte Backups aufräumen (nur letzte 30 behalten) ────────────────
$allBackups = Get-ChildItem $backupRoot -Directory | Sort-Object Name -Descending
if ($allBackups.Count -gt 30) {
    $toDelete = $allBackups | Select-Object -Skip 30
    foreach ($dir in $toDelete) {
        Remove-Item $dir.FullName -Recurse -Force
        Write-Host "Altes Backup entfernt: $($dir.Name)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "✅ Backup abgeschlossen: $backupDir" -ForegroundColor Green
Write-Host "   Verfügbare Backups: $([Math]::Min($allBackups.Count, 30))" -ForegroundColor Gray
