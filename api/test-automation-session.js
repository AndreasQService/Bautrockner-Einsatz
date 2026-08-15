import crypto from 'node:crypto';

/* global process, Buffer */

const TEST_SUPABASE_ID = 'aoxduqspiezzyqeqyzzl';
const LIVE_SUPABASE_ID = 'yxdoecdqttgdncgbzyus';
const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;
const NONCE_RE = /^[A-Za-z0-9_-]{32,128}$/;

function json(res, status, body) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(status).json(body);
}

function getRequestHost(req) {
  return String(req.headers['x-forwarded-host'] || req.headers.host || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
}

function safeEqualHex(actual, expected) {
  if (!/^[a-f0-9]{64}$/i.test(actual || '') || !/^[a-f0-9]{64}$/i.test(expected || '')) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function assertTestEnvironment(req) {
  const allowedHost = String(process.env.QTOOL_AUTOMATION_ALLOWED_HOST || '').trim().toLowerCase();
  const projectName = String(process.env.VERCEL_PROJECT_NAME || '').trim();
  const expectedRef = String(process.env.QTOOL_AUTOMATION_EXPECTED_GIT_REF || '').trim();
  const actualRef = String(process.env.VERCEL_GIT_COMMIT_REF || '').trim();
  const supabaseUrl = String(process.env.QTOOL_TEST_SUPABASE_URL || '').trim();

  if (process.env.QTOOL_AUTOMATION_ENABLED !== 'true') throw new Error('automation_disabled');
  if (!allowedHost || getRequestHost(req) !== allowedHost) throw new Error('host_rejected');
  if (projectName !== 'qtool-test') throw new Error('project_rejected');
  if (expectedRef && actualRef !== expectedRef) throw new Error('git_ref_rejected');
  if (!supabaseUrl.includes(`${TEST_SUPABASE_ID}.supabase.co`) || supabaseUrl.includes(LIVE_SUPABASE_ID)) {
    throw new Error('supabase_rejected');
  }
  return { supabaseUrl };
}

async function supabaseRest(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { response, data };
}

async function claimNonce({ supabaseUrl, serviceKey, nonce, issuedAt, keyId, requestId }) {
  const { response } = await supabaseRest(`${supabaseUrl}/rest/v1/qtool_automation_nonces`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal'
    },
    body: JSON.stringify({ nonce, issued_at: new Date(issuedAt).toISOString(), key_id: keyId, request_id: requestId })
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'nonce_replayed' : 'nonce_claim_failed');
}

async function audit({ supabaseUrl, serviceKey, event, requestId, keyId, host, detail = null }) {
  await supabaseRest(`${supabaseUrl}/rest/v1/qtool_automation_audit`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
      'content-type': 'application/json',
      prefer: 'return=minimal'
    },
    body: JSON.stringify({ event, request_id: requestId, key_id: keyId, host, detail })
  }).catch(() => undefined);
}

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed', requestId });

  let env;
  try {
    env = assertTestEnvironment(req);
  } catch {
    return json(res, 404, { error: 'not_found', requestId });
  }

  const keyId = String(req.body?.keyId || 'primary');
  const nonce = String(req.body?.nonce || '');
  const issuedAt = Number(req.body?.issuedAt);
  const signature = String(req.headers['x-qtool-automation-signature'] || '').toLowerCase();
  const secret = process.env.QTOOL_AUTOMATION_HMAC_SECRET;
  const serviceKey = process.env.QTOOL_TEST_SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.QTOOL_TEST_SUPABASE_ANON_KEY;
  const email = process.env.QTOOL_AUTOMATION_USER_EMAIL;
  const expectedUserId = String(process.env.QTOOL_AUTOMATION_USER_ID || '').trim().toLowerCase();
  const password = process.env.QTOOL_AUTOMATION_USER_PASSWORD;
  const host = getRequestHost(req);

  if (!secret || secret.length < 32 || !serviceKey || !anonKey || !email || !password ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedUserId)) {
    return json(res, 503, { error: 'automation_not_configured', requestId });
  }
  if (!NONCE_RE.test(nonce) || !Number.isSafeInteger(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_CLOCK_SKEW_MS) {
    await audit({ ...env, serviceKey, event: 'rejected', requestId, keyId, host, detail: 'invalid_freshness' });
    return json(res, 401, { error: 'unauthorized', requestId });
  }

  const payload = `${keyId}.${issuedAt}.${nonce}.${host}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  if (!safeEqualHex(signature, expected)) {
    await audit({ ...env, serviceKey, event: 'rejected', requestId, keyId, host, detail: 'invalid_signature' });
    return json(res, 401, { error: 'unauthorized', requestId });
  }

  try {
    await claimNonce({ ...env, serviceKey, nonce, issuedAt, keyId, requestId });
    const { response, data } = await supabaseRest(`${env.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: anonKey, 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!response.ok || !data?.access_token || !data?.refresh_token ||
        String(data?.user?.id || '').toLowerCase() !== expectedUserId ||
        String(data?.user?.email || '').toLowerCase() !== String(email).toLowerCase()) {
      await audit({ ...env, serviceKey, event: 'failed', requestId, keyId, host, detail: 'auth_failed' });
      return json(res, 401, { error: 'authentication_failed', requestId });
    }
    await audit({ ...env, serviceKey, event: 'issued', requestId, keyId, host, detail: data.user.id });
    return json(res, 200, {
      requestId,
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: data.expires_at,
        expires_in: data.expires_in,
        token_type: data.token_type
      },
      user: { id: data.user.id, email: data.user.email }
    });
  } catch (error) {
    const code = error?.message === 'nonce_replayed' ? 409 : 503;
    await audit({ ...env, serviceKey, event: 'failed', requestId, keyId, host, detail: error?.message || 'unknown' });
    return json(res, code, { error: code === 409 ? 'nonce_replayed' : 'temporarily_unavailable', requestId });
  }
}
