import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectSessionStatusModel,
  normalizeProjectSessionCounts,
} from '../src/lib/offline/projectSessionStatusModel.js';

const completeReadiness = () => ({
  status: 'fully_confirmed',
  verified: true,
  reasons: [],
  evidence: {
    db: { verified: true, id: 'p1', version: 4 },
    storage: { verified: true },
    oneDrive: { verified: true, itemId: 'od1', eTag: 'etag', checksum: 'sha256' },
    outbox: { total: 0, byStatus: {} },
    legacyUploadQueue: { total: 0, verified: 0, pending: 0, uploading: 0, uploaded: 0, failed: 0, needsRepair: 0 },
    unverifiedOneDriveMedia: [],
    content: { verified: true },
  },
});

test('shows offline availability only after local write and materialization verification', () => {
  assert.equal(buildProjectSessionStatusModel({ localConfirmed: true }).localAvailable, false);
  assert.equal(buildProjectSessionStatusModel({
    localConfirmed: true, localMaterializationVerified: true,
  }).localAvailable, true);
});

test('never shows provider OK from readiness flag alone', () => {
  const model = buildProjectSessionStatusModel({
    localConfirmed: true,
    localMaterializationVerified: true,
    readiness: { verified: true, status: 'fully_confirmed', reasons: [], evidence: {} },
  });
  assert.equal(model.supabaseOk, false);
  assert.equal(model.oneDriveOk, false);
  assert.equal(model.canExit, false);
});

test('allows exit only with complete local, Supabase, OneDrive and exact-content proof', () => {
  const model = buildProjectSessionStatusModel({
    localConfirmed: true,
    localMaterializationVerified: true,
    readiness: completeReadiness(),
  });
  assert.equal(model.supabaseOk, true);
  assert.equal(model.oneDriveOk, true);
  assert.equal(model.fullyConfirmed, true);
  assert.equal(model.canExit, true);
});

test('pending outbox suppresses both green badges and exit even if providers answered', () => {
  const readiness = completeReadiness();
  readiness.verified = false;
  readiness.status = 'blocked';
  readiness.reasons = ['outbox_not_empty'];
  readiness.evidence.outbox.total = 1;
  readiness.evidence.outbox.byStatus = { queued: 1 };
  const model = buildProjectSessionStatusModel({
    localConfirmed: true, localMaterializationVerified: true, readiness,
  });
  assert.equal(model.supabaseOk, false);
  assert.equal(model.oneDriveOk, false);
  assert.equal(model.canExit, false);
  assert.deepEqual(model.blockers.map(({ code }) => code), ['outbox_not_empty']);
});

test('sync action is unavailable offline or before the verified local project exists', () => {
  assert.equal(buildProjectSessionStatusModel({
    localConfirmed: true, localMaterializationVerified: true, online: false,
  }).canStartSync, false);
  assert.equal(buildProjectSessionStatusModel({ online: true }).canStartSync, false);
});

test('maps verified session-store count names to the user summary without dropping devices or measurements', () => {
  assert.deepEqual(normalizeProjectSessionCounts({
    projects: 1, rooms: 3, measurementProtocols: 2, measurements: 15,
    images: 7, equipment: 4, todos: 1,
  }), {
    projects: 1, rooms: 3, measurementProtocols: 2, measurementValues: 15,
    images: 7, deviceChanges: 4, todos: 1, pdfs: 0,
  });
});
