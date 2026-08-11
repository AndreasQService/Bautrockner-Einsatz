import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, apikey, x-client-info',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WORKER_SECRET = Deno.env.get('ONEDRIVE_FOLDER_WORKER_SECRET')!;
const TENANT_ID = Deno.env.get('ONEDRIVE_TENANT_ID')!;
const CLIENT_ID = Deno.env.get('ONEDRIVE_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('ONEDRIVE_CLIENT_SECRET')!;
const DRIVE_ID = Deno.env.get('ONEDRIVE_DRIVE_ID')!;

function safePart(value: unknown): string {
  return String(value || '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
    .replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 150);
}

async function graphToken(): Promise<string> {
  const response = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!response.ok) throw new Error(`Graph token failed (${response.status})`);
  return (await response.json()).access_token;
}

async function ensureFolder(token: string, parentPath: string, folderName: string): Promise<void> {
  const encodedParent = parentPath.split('/').map(encodeURIComponent).join('/');
  const endpoint = parentPath
    ? `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root:/${encodedParent}:/children`
    : `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/root/children`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      folder: {},
      '@microsoft.graph.conflictBehavior': 'fail',
    }),
  });
  if (response.status !== 201 && response.status !== 409) {
    const details = await response.text();
    throw new Error(`Folder '${parentPath}/${folderName}' failed (${response.status}): ${details.slice(0, 300)}`);
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  if (!WORKER_SECRET || request.headers.get('Authorization') !== `Bearer ${WORKER_SECRET}`) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: jobs, error: queueError } = await supabase
    .from('onedrive_project_folder_queue')
    .select('project_id, retry_count')
    .in('status', ['pending', 'retry'])
    .lt('retry_count', 5)
    .order('updated_at', { ascending: true })
    .limit(10);
  if (queueError) return new Response(JSON.stringify({ error: queueError.message }), { status: 500, headers: CORS_HEADERS });

  const token = await graphToken();
  let completed = 0;
  let failed = 0;
  for (const job of jobs || []) {
    try {
      await supabase.from('onedrive_project_folder_queue').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('project_id', job.project_id);
      const { data: project, error } = await supabase.from('damage_reports').select('report_data').eq('id', job.project_id).single();
      if (error || !project) throw new Error('Project not found');

      const data = project.report_data || {};
      const folderName = [
        safePart(data.projectNumber || job.project_id),
        safePart(data.street || data.schadenort?.strasse_nr),
        safePart(data.city || data.schadenort?.ort),
      ].filter(Boolean).join('_');
      if (!folderName) throw new Error('Project folder name is empty');

      await ensureFolder(token, '', 'QTool');
      await ensureFolder(token, 'QTool', folderName);
      await ensureFolder(token, `QTool/${folderName}`, 'Fotos');
      await ensureFolder(token, `QTool/${folderName}`, 'Dokumente');
      await supabase.from('onedrive_project_folder_queue').update({
        status: 'complete', folder_name: folderName, remote_path: `QTool/${folderName}`,
        last_error: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('project_id', job.project_id);
      completed++;
    } catch (error) {
      failed++;
      await supabase.from('onedrive_project_folder_queue').update({
        status: 'retry', retry_count: Number(job.retry_count || 0) + 1,
        last_error: error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000),
        updated_at: new Date().toISOString(),
      }).eq('project_id', job.project_id);
    }
  }

  return new Response(JSON.stringify({ processed: (jobs || []).length, completed, failed }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
});
