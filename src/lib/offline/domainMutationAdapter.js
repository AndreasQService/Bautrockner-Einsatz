import { registerLocalMutation } from './index.js';

export const stableMutationProjectId = (projectId, scope, entityId) =>
  String(projectId || `${scope}-${entityId || crypto.randomUUID()}`);

export async function registerDomainMutation({
  projectId,
  type,
  entityId,
  payload,
  snapshot = null,
  actor = null,
  baseVersion = null,
  tombstone = false,
}) {
  const stableProjectId = stableMutationProjectId(projectId, type.split('.')[0], entityId);
  const operationPayload = tombstone
    ? { ...payload, tombstone: true, deletedAt: payload?.deletedAt || new Date().toISOString() }
    : payload;
  return registerLocalMutation({
    projectId: stableProjectId,
    type,
    entityId: String(entityId || crypto.randomUUID()),
    payload: operationPayload,
    snapshot: snapshot || { projectId: stableProjectId, pendingMutation: { type, entityId, payload: operationPayload } },
    actor,
    baseVersion,
    idempotencyKey: `${stableProjectId}:${type}:${entityId || crypto.randomUUID()}:${crypto.randomUUID()}`,
  });
}
