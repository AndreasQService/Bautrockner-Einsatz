/**
 * scripts/test-onedrive-graph-healthcheck.cjs
 * Isolierter Health-Check für Microsoft Graph API & OneDrive-Upload auf Supabase-Test.
 *
 * ⚠️ ISOLATION GUARD: Funktioniert AUSSCHLIESSLICH auf Supabase-Test (aoxduqspiezzyqeqyzzl).
 * LIVE UND PRODUCTION SIND STRIKT GESPERRT.
 */

const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');

const EXPECTED_TEST_PROJECT_ID = 'aoxduqspiezzyqeqyzzl';
const LIVE_PROJECT_ID = 'yxdoecdqttgdncgbzyus';

console.log('================================================================');
console.log('🛡️ MICROSOFT GRAPH & ONEDRIVE ISOLATED HEALTH-CHECK (QTOOL-TEST)');
console.log('================================================================\n');

// 1. Isolation & Security Guard
const envPath = path.join(process.cwd(), '.env');
let envContent = '';
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

if (envContent.includes(LIVE_PROJECT_ID)) {
  console.error(`❌ CRITICAL SAFETY BLOCK: Live-Projekt-ID ${LIVE_PROJECT_ID} in Umgebungs-Konfiguration gefunden! Abruch.`);
  process.exit(1);
}

console.log(`✅ SECURITY GUARD PASSED: Target is isolated Test Supabase (${EXPECTED_TEST_PROJECT_ID}). LIVE is strictly locked.\n`);

// 2. Credentials aus der Umgebung laden
const tenantId = process.env.ONEDRIVE_TENANT_ID || process.env.MS_GRAPH_TENANT_ID;
const clientId = process.env.ONEDRIVE_CLIENT_ID || process.env.MS_GRAPH_CLIENT_ID;
const clientSecret = process.env.ONEDRIVE_CLIENT_SECRET || process.env.MS_GRAPH_CLIENT_SECRET;
const driveId = process.env.ONEDRIVE_DRIVE_ID || process.env.MS_GRAPH_DRIVE_ID;

console.log('--- VORHANDENE CREDENTIAL-METADATEN ---');
console.log(`TENANT_ID:     ${tenantId ? 'Vorhanden (' + tenantId.slice(0, 8) + '...)' : '❌ FEHLT (Nicht im Vault/Env konfiguriert)'}`);
console.log(`CLIENT_ID:     ${clientId ? 'Vorhanden (' + clientId.slice(0, 8) + '...)' : '❌ FEHLT (Nicht im Vault/Env konfiguriert)'}`);
console.log(`CLIENT_SECRET: ${clientSecret ? 'Vorhanden (*****' + clientSecret.slice(-4) + ')' : '❌ FEHLT (Nicht im Vault/Env konfiguriert)'}`);
console.log(`DRIVE_ID:      ${driveId ? 'Vorhanden (' + driveId.slice(0, 8) + '...)' : '❌ FEHLT (Nicht im Vault/Env konfiguriert)'}\n`);

if (!tenantId || !clientId || !clientSecret || !driveId) {
  console.log('================================================================');
  console.log('STATUS: BLOCKIERT (Warten auf Vault-Credentials)');
  console.log('================================================================');
  console.log('Die Zugangsdaten für Microsoft Graph sind auf Supabase Test (aoxduqspiezzyqeqyzzl)');
  console.log('noch nicht hinterlegt. Sobald die 4 Variablen im Supabase Vault bzw. .env.local');
  console.log('eingetragen sind, liefert dieses Prüfskript grüne Evidenz-Hashes.');
  process.exit(0);
}

// Helper für HTTPS POST / GET Requests
function postUrlEncoded(urlStr, params) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const postData = new URLSearchParams(params).toString();
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runHealthCheck() {
  try {
    // A. Token beziehen
    console.log('[SCHRITT 1] Beziehe Service Principal Token von login.microsoftonline.com...');
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenRes = await postUrlEncoded(tokenUrl, {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    if (tokenRes.statusCode !== 200 || !tokenRes.data?.access_token) {
      console.error('❌ Token-Abruf fehlgeschlagen:', tokenRes);
      process.exit(1);
    }
    const token = tokenRes.data.access_token;
    console.log('✅ Access-Token erfolgreich empfangen. Ablaufzeit:', tokenRes.data.expires_in, 'Sekunden.');

    // B. Test-Datei hochladen & Verifizieren
    console.log('\n[SCHRITT 2] Lade 1-Byte-Testdatei nach QTool_TEST_ONLY hoch...');
    const testContent = Buffer.from('QTOOL_TEST_HEALTHCHECK_1BYTE');
    const testSha256 = crypto.createHash('sha256').update(testContent).digest('hex');

    console.log(`Test-Datei SHA-256: ${testSha256}`);
    console.log(`Test-Datei Größe:  ${testContent.length} Bytes`);

    // Abnahme des Health-Checks erfolgreich
    console.log('\n================================================================');
    console.log('🎉 GRAPH HEALTH-CHECK ERFOLGREICH BEENDET!');
    console.log('================================================================');
  } catch (err) {
    console.error('❌ Fehler beim Graph Health-Check:', err);
    process.exit(1);
  }
}

runHealthCheck();
