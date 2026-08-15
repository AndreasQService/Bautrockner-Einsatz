import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  assertSupabaseRequestAllowed,
  assertOneDriveWriteAllowed,
  beginExplicitProjectFinalSync,
  createSessionGuardedFetch,
  endExplicitProjectFinalSync,
} from '../src/lib/offline/sessionCloudWriteGate.js';

const active = { hasActiveSession: async () => true };

let context = null;
afterEach(() => {
  endExplicitProjectFinalSync(context);
  context = null;
});

describe('strict session cloud-write gate', () => {
  it('allows reads while a project session is active', async () => {
    await assert.doesNotReject(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/damage_reports?select=*',
      { method: 'GET' },
      active,
    ));
  });

  it('blocks REST and Storage writes outside explicit finish', async () => {
    await assert.rejects(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/damage_reports?id=eq.1',
      { method: 'PATCH' },
      active,
    ), error => error.code === 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED');
    await assert.rejects(assertSupabaseRequestAllowed(
      'https://test.supabase.co/storage/v1/object/case-files/cases/1/image.jpg',
      { method: 'POST' },
      active,
    ), error => error.code === 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED');
    await assert.rejects(assertSupabaseRequestAllowed(
      'https://test.supabase.co/functions/v1/delete-project',
      { method: 'POST' },
      active,
    ), error => error.code === 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED');
  });

  it('blocks OneDrive writes outside finish and allows them only inside owner context', async () => {
    await assert.rejects(
      assertOneDriveWriteAllowed('PUT', active),
      error => error.code === 'ACTIVE_PROJECT_SESSION_ONEDRIVE_WRITE_BLOCKED',
    );
    context = beginExplicitProjectFinalSync({ projectId: 'p1', ownerSessionToken: 'owner-1' });
    await assert.doesNotReject(assertOneDriveWriteAllowed('PUT', active));
  });

  it('allows technical lock RPCs but blocks business RPCs', async () => {
    await assert.doesNotReject(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/rpc/acquire_project_lock',
      { method: 'POST' },
      active,
    ));
    await assert.doesNotReject(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/rpc/get_project_lock_status',
      { method: 'POST' },
      active,
    ));
    await assert.rejects(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/rpc/fn_complete_and_create_todo',
      { method: 'POST' },
      active,
    ), error => error.code === 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED');
  });

  it('opens writes only for an explicit final sync with owner token', async () => {
    assert.throws(() => beginExplicitProjectFinalSync({ projectId: 'p1' }), /Token/);
    context = beginExplicitProjectFinalSync({ projectId: 'p1', ownerSessionToken: 'owner-1' });
    await assert.doesNotReject(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/damage_reports?id=eq.p1',
      { method: 'PATCH' },
      active,
    ));
  });

  it('injects owner token and project id without mutating caller headers', async () => {
    const originalHeaders = new Headers({ 'content-type': 'application/json' });
    let captured;
    const guardedFetch = createSessionGuardedFetch(async (input, init) => {
      captured = { input, init };
      return new Response('{}', { status: 200 });
    }, active);
    context = beginExplicitProjectFinalSync({ projectId: 'p1', ownerSessionToken: 'owner-1' });
    await guardedFetch('https://test.supabase.co/rest/v1/damage_reports?id=eq.p1', {
      method: 'PATCH', headers: originalHeaders, body: '{}',
    });
    assert.equal(captured.init.headers.get('x-qtool-session-token'), 'owner-1');
    assert.equal(captured.init.headers.get('x-qtool-project-id'), 'p1');
    assert.equal(originalHeaders.has('x-qtool-session-token'), false);
  });

  it('injects owner evidence into explicit Edge Function writes', async () => {
    let captured;
    const guardedFetch = createSessionGuardedFetch(async (input, init) => {
      captured = { input, init };
      return new Response('{}', { status: 200 });
    }, active);
    context = beginExplicitProjectFinalSync({ projectId: 'p1', ownerSessionToken: 'owner-1' });
    await guardedFetch('https://test.supabase.co/functions/v1/delete-project', {
      method: 'POST', body: '{}',
    });
    assert.equal(captured.init.headers.get('x-qtool-session-token'), 'owner-1');
    assert.equal(captured.init.headers.get('x-qtool-project-id'), 'p1');
  });

  it('closes the gate after finish and rejects concurrent/nested finish contexts', async () => {
    context = beginExplicitProjectFinalSync({ projectId: 'p1', ownerSessionToken: 'owner-1' });
    assert.throws(
      () => beginExplicitProjectFinalSync({ projectId: 'p2', ownerSessionToken: 'owner-2' }),
      /bereits/,
    );
    endExplicitProjectFinalSync(context);
    context = null;
    await assert.rejects(assertSupabaseRequestAllowed(
      'https://test.supabase.co/rest/v1/damage_reports?id=eq.p1',
      { method: 'PATCH' }, active,
    ), error => error.code === 'ACTIVE_PROJECT_SESSION_CLOUD_WRITE_BLOCKED');
  });
});
