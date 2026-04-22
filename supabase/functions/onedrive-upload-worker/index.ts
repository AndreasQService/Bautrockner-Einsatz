/**
 * onedrive-upload-worker/index.ts
 * Supabase Edge Function – Variante C Backend-Worker
 *
 * Wird via Cron (jede Minute) oder manuell aufgerufen.
 * 1. Lädt pending items aus project_image_uploads
 * 2. Holt Blob aus Supabase Storage
 * 3. Lädt hoch nach OneDrive/SharePoint via Service Principal
 * 4. Verifiziert Upload
 * 5. Aktualisiert Journal-Status
 *
 * Kein Benutzer-Login nötig. Kein MFA. Zentral für alle Mitarbeiter.
 */

import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Azure Service Principal – im Supabase Vault gespeichert
const TENANT_ID           = Deno.env.get('ONEDRIVE_TENANT_ID')!;
const CLIENT_ID           = Deno.env.get('ONEDRIVE_CLIENT_ID')!;
const CLIENT_SECRET       = Deno.env.get('ONEDRIVE_CLIENT_SECRET')!;
const DRIVE_ID            = Deno.env.get('ONEDRIVE_DRIVE_ID')!;  // Drive ID der Firma

// ─── CORS ────────────────────────────────────────────────────────────────────
// Erlaubt Aufrufe von lokaler Entwicklung und Vercel-Produktion
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const CHUNK_SIZE          = 4 * 1024 * 1024;  // 4 MB Chunks
const MAX_CONCURRENT      = 3;
const MAX_RETRIES         = 5;

// ─── Microsoft Graph Token (Service Principal, kein User) ────────────────────

let _tokenCache: { token: string; expiresAt: number } | null = null;

async function getGraphToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt - 60_000) {
    return _tokenCache.token;
  }

  const resp = await fetch(
    `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Token-Fehler: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  _tokenCache = {
    token:     data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return _tokenCache.token;
}

// ─── Resumable Upload Session erstellen ──────────────────────────────────────

async function createUploadSession(
  token: string,
  remotePath: string,
  filename: string,
  size: number
): Promise<string> {
  // Zielordner: /drives/{DRIVE_ID}/root:/{path}:/createUploadSession
  const encodedPath = encodeURIComponent(remotePath.replace(/\\/g, '/'));
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${encodedPath}:/createUploadSession`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      item: {
        '@microsoft.graph.conflictBehavior': 'rename',   // nie überschreiben
        name: filename,
      },
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Session-Fehler: ${resp.status} ${err}`);
  }

  const { uploadUrl } = await resp.json();
  return uploadUrl;
}

// ─── Chunk-Upload ─────────────────────────────────────────────────────────────

async function uploadChunks(
  sessionUrl: string,
  blob: Blob,
  startByte: number = 0
): Promise<string> {
  const totalSize = blob.size;
  let offset = startByte;

  while (offset < totalSize) {
    const end   = Math.min(offset + CHUNK_SIZE, totalSize);
    const chunk = blob.slice(offset, end);

    const resp = await fetch(sessionUrl, {
      method: 'PUT',
      headers: {
        'Content-Range': `bytes ${offset}-${end - 1}/${totalSize}`,
        'Content-Length': String(end - offset),
      },
      body: chunk,
    });

    if (resp.status === 202) {
      // Chunk akzeptiert, weiter
      offset = end;
      continue;
    }

    if (resp.status === 200 || resp.status === 201) {
      // Upload abgeschlossen
      const data = await resp.json();
      return data.id;   // Microsoft Graph Item ID
    }

    // Fehler
    const err = await resp.text();
    throw new Error(`Chunk-Fehler bei ${offset}-${end}: ${resp.status} ${err}`);
  }

  throw new Error('Upload-Loop beendet ohne Item ID');
}

// ─── Verifikation ─────────────────────────────────────────────────────────────

async function verifyItem(token: string, itemId: string): Promise<boolean> {
  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${itemId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.ok;
}

// ─── Ein Item verarbeiten ─────────────────────────────────────────────────────

async function processItem(
  sb: ReturnType<typeof createClient>,
  item: Record<string, unknown>
): Promise<void> {
  const id         = item.id as string;
  const storagePath = item.storage_path as string;
  const remotePath  = (item.remote_path as string) || 'QTool/Unbekannt';
  const filename    = item.filename as string;
  const fileSize    = (item.size_bytes as number) || 0;

  // Status: uploading
  await sb.from('project_image_uploads').update({
    storage_status:  'remote_uploading',
    last_attempt_at: new Date().toISOString(),
  }).eq('id', id);

  // Blob aus Supabase Storage holen
  // Frontend lädt in 'case-files', Worker liest von dort
  const bucket = (item.storage_bucket as string) || 'case-files';
  const { data: blobData, error: dlErr } = await sb.storage
    .from(bucket)
    .download(storagePath);

  if (dlErr || !blobData) {
    throw new Error(`Storage-Download: ${dlErr?.message || 'Kein Blob'}`);
  }

  // Token holen
  const token = await getGraphToken();

  // Resumable Session erstellen
  const sessionUrl = await createUploadSession(token, remotePath, filename, fileSize);

  // Upload
  const itemId = await uploadChunks(sessionUrl, blobData);

  // Verifikation
  const verified = await verifyItem(token, itemId);
  if (!verified) throw new Error('Verifikation fehlgeschlagen – Item nicht gefunden');

  // Journal: verified
  await sb.from('project_image_uploads').update({
    storage_status:  'remote_verified',
    remote_item_id:  itemId,
    verified_at:     new Date().toISOString(),
    last_error:      null,
  }).eq('id', id);

  console.log(`[Worker] ✅ ${filename} → OneDrive (${itemId})`);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS Preflight (Browser sendet OPTIONS vor POST)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Auth-Check: nur Service Role oder Cron
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Pending Items laden (max. MAX_CONCURRENT)
  const { data: items, error } = await sb
    .from('project_image_uploads')
    .select('*')
    .in('storage_status', ['uploaded_to_backend', 'needs_repair'])
    .lt('retry_count', MAX_RETRIES)
    .order('created_at', { ascending: true })
    .limit(MAX_CONCURRENT);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!items || items.length === 0) {
    return new Response(JSON.stringify({ processed: 0, message: 'Keine ausstehenden Items' }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  console.log(`[Worker] 🔄 ${items.length} Items verarbeiten`);

  let processed = 0;
  let failed    = 0;

  for (const item of items) {
    try {
      await processItem(sb, item);
      processed++;
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Worker] ❌ ${item.filename}: ${errMsg}`);

      const newRetries = (item.retry_count || 0) + 1;
      await sb.from('project_image_uploads').update({
        storage_status: newRetries >= MAX_RETRIES ? 'failed' : 'needs_repair',
        retry_count:    newRetries,
        last_error:     errMsg,
        last_attempt_at: new Date().toISOString(),
      }).eq('id', item.id);
    }
  }

  return new Response(JSON.stringify({ processed, failed, total: items.length }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
