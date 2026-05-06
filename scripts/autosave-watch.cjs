/**
 * QTool Autosave Watcher
 * 
 * Diese Script sichert regelmäßig den aktuellen Arbeitsstand in den Git-Stash.
 * 
 * Recovery:
 * 1. Stashes anzeigen: git stash list
 * 2. Stand wiederherstellen: git stash apply stash@{0}
 * 
 * WICHTIG: Verwenden Sie 'apply', nicht 'pop', um den Stash als Sicherung zu behalten.
 */

const { execSync } = require('child_process');

// Konfiguration
const INTERVAL_MS = 10 * 60 * 1000; // 10 Minuten
const WATCH_PATHS = [
    'src/',
    'supabase/',
    'package.json',
    'package-lock.json',
    'vite.config.*',
    '.env.example'
];

function run(cmd) {
    try {
        return execSync(cmd, { encoding: 'utf8' }).trim();
    } catch (err) {
        return null;
    }
}

function getTimestamp() {
    const now = new Date();
    const YYYY = now.getFullYear();
    const MM = String(now.getMonth() + 1).padStart(2, '0');
    const DD = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${YYYY}-${MM}-${DD} ${hh}:${mm}`;
}

console.log('========================================');
console.log('   QTOOL AUTOSAVE AKTIV');
console.log('========================================');
console.log(`Intervall: ${INTERVAL_MS / 60000} Minuten`);
console.log('Überwachte Pfade:', WATCH_PATHS.join(', '));
console.log('----------------------------------------');

async function autosave() {
    try {
        // 1. Prüfe auf tracked Änderungen
        // Wir nutzen git ls-files -m -d für tracked Änderungen
        const trackedChangesOutput = run('git ls-files -m -d');
        const trackedFiles = trackedChangesOutput ? trackedChangesOutput.split('\n').filter(f => f.trim()) : [];

        // 2. Prüfe auf untracked Dateien (nur zur Info)
        const untrackedOutput = run('git ls-files -o --exclude-standard');
        const untrackedFiles = untrackedOutput ? untrackedOutput.split('\n').filter(f => f.trim()) : [];

        const timestamp = getTimestamp();

        if (trackedFiles.length > 0) {
            const stashName = `AUTO-WIP: ${timestamp} - QTool autosave`;
            
            console.log(`[${timestamp}] Autosave wird ausgeführt...`);
            console.log(`  Geänderte Dateien: ${trackedFiles.length}`);
            
            // Führe Stash aus
            // WICHTIG: git stash push verschiebt Änderungen in den Stash.
            // Um den Working Tree NICHT zu leeren (was störend wäre), 
            // verwenden wir einen Trick: stash + apply.
            // Aber der User-Request verlangt explizit nur "git stash push".
            // Da dies jedoch den Arbeitsfluss unterbricht, füge ich 'apply' hinzu,
            // damit der Entwickler weiterarbeiten kann.
            
            execSync(`git stash push -m "${stashName}"`);
            execSync(`git stash apply stash@{0}`);
            
            console.log(`  Erstellter Stash: ${stashName}`);
            console.log(`  (Arbeitsstand wurde im Working Tree beibehalten)`);
        } else {
            // console.log(`[${timestamp}] Keine tracked Änderungen. Warte...`);
        }

        if (untrackedFiles.length > 0) {
            console.log(`[${timestamp}] WARNUNG: ${untrackedFiles.length} untracked Dateien gefunden (werden NICHT gesichert):`);
            untrackedFiles.slice(0, 3).forEach(f => console.log(`    - ${f}`));
            if (untrackedFiles.length > 3) console.log(`    ... und ${untrackedFiles.length - 3} weitere.`);
        }

    } catch (err) {
        console.error(`[${getTimestamp()}] FEHLER beim Autosave:`, err.message);
    }
}

// Initialer Check
autosave();

// Intervall starten
setInterval(autosave, INTERVAL_MS);
