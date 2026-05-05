/**
 * Supabase Edge Function: onedrive-sync
 * Verarbeitet die onedrive_sync_queue und archiviert Daten zu OneDrive.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ROOT_FOLDER = 'QTool';

serve(async (req) => {
  try {
    // 1. Initialisierung
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 2. Pending Items aus der Queue holen
    const { data: queueItems, error: fetchError } = await supabaseAdmin
      .from('onedrive_sync_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(5); // Chargenweise verarbeiten

    if (fetchError) throw fetchError;
    if (!queueItems || queueItems.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending items' }), { status: 200 });
    }

    // 3. OneDrive Access Token holen (Client Credentials Flow)
    const accessToken = await getOneDriveAccessToken();

    const results = [];
    for (const item of queueItems) {
      try {
        // Status auf 'uploading' setzen
        await supabaseAdmin.from('onedrive_sync_queue').update({ status: 'uploading' }).eq('id', item.id);

        // Pfad bestimmen (Jahr/Projekt_ID_Name/...)
        const year = new Date().getFullYear().toString();
        const folderName = `P-${item.project_id}`; // Vereinfacht für das Beispiel
        const onedrivePath = `${ROOT_FOLDER}/${year}/${folderName}`;

        // Upload zu OneDrive
        const success = await uploadToOneDrive(accessToken, onedrivePath, item);

        if (success) {
          await supabaseAdmin.from('onedrive_sync_queue').update({ 
            status: 'synced',
            onedrive_path: onedrivePath,
            updated_at: new Date().toISOString()
          }).eq('id', item.id);
          results.push({ id: item.id, status: 'success' });
        }
      } catch (err) {
        await supabaseAdmin.from('onedrive_sync_queue').update({ 
          status: 'failed',
          last_error: err.message,
          retry_count: (item.retry_count || 0) + 1
        }).eq('id', item.id);
        results.push({ id: item.id, status: 'error', message: err.message });
      }
    }

    return new Response(JSON.stringify(results), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
})

/**
 * Holt ein App-Only Access Token für Microsoft Graph
 */
async function getOneDriveAccessToken() {
  const tenantId = Deno.env.get('MS_TENANT_ID');
  const clientId = Deno.env.get('MS_CLIENT_ID');
  const clientSecret = Deno.env.get('MS_CLIENT_SECRET');

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId || '',
    scope: 'https://graph.microsoft.com/.default',
    client_secret: clientSecret || '',
    grant_type: 'client_credentials',
  });

  const resp = await fetch(url, { method: 'POST', body });
  const data = await resp.json();
  if (!resp.ok) throw new Error(`MS Auth Failed: ${data.error_description}`);
  return data.access_token;
}

/**
 * Lädt eine Datei zu OneDrive hoch
 */
async function uploadToOneDrive(token, folderPath, item) {
  const fileName = item.type === 'project_json' ? 'Projektdaten.json' : 'dokument.bin';
  const content = item.type === 'project_json' ? JSON.stringify(item.payload) : item.payload;

  // Ordner sicherstellen (rekursiv über Graph API oder einfachen Pfad-Upload)
  const uploadUrl = `https://graph.microsoft.com/v1.0/me/drive/root:/${folderPath}/${fileName}:/content`;
  
  const resp = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: content
  });

  return resp.ok;
}
