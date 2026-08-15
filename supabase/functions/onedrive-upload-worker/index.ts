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
import { excludeLockedProjectItems } from '../_shared/lockedProjectFilter.js';

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
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-qtool-worker-secret, x-qtool-session-token, x-qtool-project-id',
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
        // remotePath is the journal's deterministic idempotency key. A retry
        // after a lost final response must replace that exact target instead
        // of creating "(1)" duplicates.
        '@microsoft.graph.conflictBehavior': 'replace',
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

type RemoteProof = {
  remote_drive_id: string;
  remote_item_id: string;
  remote_etag: string;
  remote_size_bytes: number;
  remote_sha256: string;
  verified_at: string;
};

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
}

// Evidence is produced by the service-principal worker against the exact
// configured company drive. The browser must never try to re-prove this via
// /me/drive, which may resolve to an entirely different personal drive.
async function verifyItemBytes(
  token: string,
  itemId: string,
  expectedSize: number,
  expectedSha256: string,
): Promise<RemoteProof> {
  if (!DRIVE_ID) throw new Error('ONEDRIVE_DRIVE_ID fehlt');
  const base = `https://graph.microsoft.com/v1.0/drives/${encodeURIComponent(DRIVE_ID)}/items/${encodeURIComponent(itemId)}`;
  const metadataResponse = await fetch(`${base}?$select=id,eTag,size,parentReference`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!metadataResponse.ok) throw new Error(`OneDrive-Metadatenprüfung fehlgeschlagen (${metadataResponse.status})`);
  const metadata = await metadataResponse.json();
  if (String(metadata?.id || '') !== itemId
    || String(metadata?.parentReference?.driveId || '') !== DRIVE_ID
    || !metadata?.eTag
    || Number(metadata?.size) !== expectedSize) {
    throw new Error('OneDrive Item-/Drive-/ETag-/Grössen-Evidenz stimmt nicht');
  }
  const contentResponse = await fetch(`${base}/content`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!contentResponse.ok) throw new Error(`OneDrive-Byte-Readback fehlgeschlagen (${contentResponse.status})`);
  const remoteBlob = await contentResponse.blob();
  const remoteSha256 = await sha256Hex(remoteBlob);
  if (remoteBlob.size !== expectedSize || remoteSha256.toLowerCase() !== expectedSha256.toLowerCase()) {
    throw new Error('OneDrive Byte-Grösse/SHA-256 stimmt nicht');
  }
  return {
    remote_drive_id: DRIVE_ID,
    remote_item_id: itemId,
    remote_etag: metadata.eTag,
    remote_size_bytes: remoteBlob.size,
    remote_sha256: remoteSha256,
    verified_at: new Date().toISOString(),
  };
}

// ─── Edge Function Test Guard ────────────────────────────────────────────────
const EXPECTED_TEST_ROOT = 'QTool_TEST_ONLY';
const TESTRUN_ID_REGEX = /^TESTRUN_\d{4}-\d{2}-\d{2}_\d{6}_[A-Z0-9]{4,12}$/;
const ALLOWED_SUBFOLDERS = new Set(['Fotos', 'Dokumente', 'Messprotokolle']);
const WINDOWS_RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

function validateEdgeOneDrivePath(remotePath: string): void {
  const envTestRoot = Deno.env.get('ONEDRIVE_TEST_ROOT');
  const envQToolEnv  = Deno.env.get('QTOOL_ENVIRONMENT');

  if (envQToolEnv !== 'test' || envTestRoot !== EXPECTED_TEST_ROOT) {
    throw new Error(`[EDGE GUARD ABORT] Unzulässige Serverumgebung (ONEDRIVE_TEST_ROOT='${envTestRoot}', QTOOL_ENVIRONMENT='${envQToolEnv}').`);
  }

  if (!remotePath || typeof remotePath !== 'string' || remotePath.length > 400) {
    throw new Error('[EDGE GUARD ABORT] Remote Pfad ungültig oder zu lang.');
  }

  if (/[\%\?\#\\:\x00-\x1F\u2044\u2215\u29F8\uFF0F\uFF3C]/.test(remotePath)) {
    throw new Error(`[EDGE GUARD ABORT] Illegales Sonderzeichen oder Kodierung in Pfad '${remotePath}'.`);
  }

  if (/\/\.\.\/|\/\.\.$|^\.\.\//.test(remotePath)) {
    throw new Error(`[EDGE GUARD ABORT] Path Traversal ('..') in '${remotePath}' erkannt.`);
  }

  const segments = remotePath.split('/');

  // Individual segment validations
  for (const seg of segments) {
    if (!seg || seg.trim() === '') {
      throw new Error('[EDGE GUARD ABORT] Segment darf nicht leer sein.');
    }
    if (seg.length > 150) {
      throw new Error(`[EDGE GUARD ABORT] Segment '${seg}' überschreitet Maximallänge von 150 Zeichen.`);
    }
    if (seg === '.' || seg === '..' || seg.endsWith('.') || seg.endsWith(' ')) {
      throw new Error(`[EDGE GUARD ABORT] Segment '${seg}' darf nicht auf Punkt/Leerzeichen enden oder '.'/'..' sein.`);
    }
    const rawBase = seg.split('.')[0].replace(/^TEST__/, '').toUpperCase();
    if (WINDOWS_RESERVED.has(rawBase)) {
      throw new Error(`[EDGE GUARD ABORT] Reservierter Systemname '${seg}' unzulässig.`);
    }
  }

  // Segment 0: MUST be QTool_TEST_ONLY
  if (segments[0] !== EXPECTED_TEST_ROOT) {
    throw new Error(`[EDGE GUARD ABORT] Stammordner muss exakt '${EXPECTED_TEST_ROOT}' sein, erhalten: '${segments[0]}'.`);
  }

  // Segment 1: MUST match TESTRUN_ID_REGEX
  if (!TESTRUN_ID_REGEX.test(segments[1])) {
    throw new Error(`[EDGE GUARD ABORT] Ungültiges testRunId Format im Pfad: '${segments[1]}'.`);
  }

  // Manifest case: EXACTLY 3 segments
  if (segments.length === 3) {
    if (segments[2] !== 'TEST_MANIFEST.json') {
      throw new Error(`[EDGE GUARD ABORT] Direkt im Testlauf-Ordner ist nur 'TEST_MANIFEST.json' erlaubt, erhalten: '${segments[2]}'.`);
    }
    return;
  }

  // File case: EXACTLY 5 segments
  if (segments.length !== 5) {
    throw new Error(`[EDGE GUARD ABORT] Pfadtiefe für Nutzdateien muss exakt 5 Segmente sein, erhalten: ${segments.length}.`);
  }

  // Segment 2: Project folder must start with TEST__
  if (!segments[2].startsWith('TEST__')) {
    throw new Error(`[EDGE GUARD ABORT] Projektordner '${segments[2]}' muss mit 'TEST__' beginnen.`);
  }

  // Segment 3: Subfolder must be strictly Fotos, Dokumente, or Messprotokolle
  if (!ALLOWED_SUBFOLDERS.has(segments[3])) {
    throw new Error(`[EDGE GUARD ABORT] Unzulässiger Unterordner '${segments[3]}'. Erlaubt: Fotos, Dokumente, Messprotokolle.`);
  }

  // Segment 4: File name must start with TEST__
  if (!segments[4].startsWith('TEST__')) {
    throw new Error(`[EDGE GUARD ABORT] Dateiname '${segments[4]}' muss mit 'TEST__' beginnen.`);
  }
}

// ─── Ein Item verarbeiten ─────────────────────────────────────────────────────

async function processItem(
  sb: ReturnType<typeof createClient>,
  item: Record<string, unknown>
): Promise<void> {
  const id         = item.id as string;
  const storagePath = item.storage_path as string;
  const remotePath  = (item.remote_path as string) || '';
  const filename    = item.filename as string;
  const fileSize    = (item.size_bytes as number) || 0;
  const expectedSha = String(item.sha256 || '').toLowerCase();

  if (!fileSize || !/^[a-f0-9]{64}$/.test(expectedSha)) {
    throw new Error('Transferjournal enthält keine vertrauenswürdige Grösse/SHA-256');
  }

  // Strikten Edge Guard vor JEDEM Schritt aufrufen!
  validateEdgeOneDrivePath(remotePath);

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
  const proof = await verifyItemBytes(token, itemId, fileSize, expectedSha);

  // Journal: verified
  const { data: persistedProof, error: proofError } = await sb.from('project_image_uploads').update({
    storage_status:  'remote_verified',
    ...proof,
    last_error:      null,
  }).eq('id', id)
    .select('project_id,local_image_id,storage_status,remote_drive_id,remote_item_id,remote_etag,remote_size_bytes,remote_sha256,verified_at')
    .single();
  if (proofError
    || persistedProof?.storage_status !== 'remote_verified'
    || persistedProof?.remote_drive_id !== proof.remote_drive_id
    || persistedProof?.remote_item_id !== proof.remote_item_id
    || persistedProof?.remote_etag !== proof.remote_etag
    || Number(persistedProof?.remote_size_bytes) !== proof.remote_size_bytes
    || persistedProof?.remote_sha256 !== proof.remote_sha256
    || persistedProof?.verified_at !== proof.verified_at) {
    throw new Error(`OneDrive-Evidenz konnte nicht vollständig persistiert/rückgelesen werden: ${proofError?.message || 'Abweichung'}`);
  }

  console.log(`[Worker] ✅ ${filename} → OneDrive (${itemId})`);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS Preflight (Browser sendet OPTIONS vor POST)
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Background jobs require the configured worker secret. Browser final-sync
  // calls require a valid JWT plus the exact owner session/project scope.
  const authHeader = req.headers.get('Authorization');
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const configuredWorkerSecret = Deno.env.get('QTOOL_WORKER_SECRET');
  const isWorker = Boolean(configuredWorkerSecret && req.headers.get('x-qtool-worker-secret') === configuredWorkerSecret);
  let scopedProjectId: string | null = null;
  if (!isWorker) {
    if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
    const jwt = authHeader.slice('Bearer '.length).trim();
    const { data: authData, error: authError } = await sb.auth.getUser(jwt);
    const sessionToken = req.headers.get('x-qtool-session-token');
    scopedProjectId = req.headers.get('x-qtool-project-id');
    if (authError || !authData?.user || !scopedProjectId || !sessionToken || sessionToken.length < 20) {
      return new Response('Owner session required', { status: 403, headers: CORS_HEADERS });
    }
    const { data: owner } = await sb.from('project_sessions').select('session_token')
      .eq('open_project_id', scopedProjectId).eq('session_token', sessionToken)
      .eq('owner_user_id', authData.user.id).maybeSingle();
    if (!owner) return new Response('Project lock not owned', { status: 409, headers: CORS_HEADERS });
  }

  // Pending Items laden (max. MAX_CONCURRENT)
  let pendingQuery = sb
    .from('project_image_uploads')
    .select('*')
    .in('storage_status', ['uploaded_to_backend', 'needs_repair'])
    .lt('retry_count', MAX_RETRIES);
  if (scopedProjectId) pendingQuery = pendingQuery.eq('project_id', scopedProjectId);
  const { data: candidateItems, error } = await pendingQuery
    .order('created_at', { ascending: true })
    .limit(MAX_CONCURRENT);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // A trusted background worker still may not write business data for any
  // project currently open offline. Only the exact browser-owner final-sync
  // path above may process its scoped project.
  let items = candidateItems || [];
  if (isWorker && items.length > 0) {
    const projectIds = [...new Set(items.map(item => String(item.project_id || '')).filter(Boolean))];
    if (projectIds.length > 0) {
      const { data: activeLocks, error: lockError } = await sb.from('project_sessions')
        .select('open_project_id').in('open_project_id', projectIds).not('open_project_id', 'is', null);
      if (lockError) return new Response(JSON.stringify({ error: lockError.message }), {
        status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
      items = excludeLockedProjectItems(items, activeLocks || []);
    }
  }

  if (items.length === 0) {
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
