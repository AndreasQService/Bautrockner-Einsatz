export const OFFLINE_STATES = Object.freeze({
  LOCAL_SAVING: 'local_saving',
  LOCAL_CONFIRMED: 'local_confirmed',
  QUEUED: 'queued',
  UPLOADING: 'uploading',
  CLOUD_CONFIRMED: 'cloud_confirmed',
  CONFLICT: 'conflict',
  FAILED: 'failed',
});

export const TERMINAL_OFFLINE_STATES = Object.freeze([
  OFFLINE_STATES.CLOUD_CONFIRMED,
  OFFLINE_STATES.CONFLICT,
]);

const ALLOWED_TRANSITIONS = Object.freeze({
  [OFFLINE_STATES.LOCAL_SAVING]: new Set([
    OFFLINE_STATES.LOCAL_CONFIRMED,
    OFFLINE_STATES.FAILED,
  ]),
  [OFFLINE_STATES.LOCAL_CONFIRMED]: new Set([
    OFFLINE_STATES.QUEUED,
    OFFLINE_STATES.CLOUD_CONFIRMED,
    OFFLINE_STATES.FAILED,
  ]),
  [OFFLINE_STATES.QUEUED]: new Set([
    OFFLINE_STATES.UPLOADING,
    OFFLINE_STATES.CONFLICT,
    OFFLINE_STATES.FAILED,
  ]),
  [OFFLINE_STATES.UPLOADING]: new Set([
    OFFLINE_STATES.QUEUED,
    OFFLINE_STATES.CLOUD_CONFIRMED,
    OFFLINE_STATES.CONFLICT,
    OFFLINE_STATES.FAILED,
  ]),
  [OFFLINE_STATES.FAILED]: new Set([
    OFFLINE_STATES.QUEUED,
    OFFLINE_STATES.CONFLICT,
  ]),
  [OFFLINE_STATES.CLOUD_CONFIRMED]: new Set(),
  [OFFLINE_STATES.CONFLICT]: new Set([
    OFFLINE_STATES.QUEUED,
  ]),
});

export function assertOfflineState(state) {
  if (!Object.values(OFFLINE_STATES).includes(state)) {
    throw new Error(`Unbekannter Offline-Status: ${state}`);
  }
  return state;
}

export function assertStateTransition(from, to) {
  assertOfflineState(from);
  assertOfflineState(to);
  if (from !== to && !ALLOWED_TRANSITIONS[from].has(to)) {
    throw new Error(`Ungültiger Offline-Statuswechsel: ${from} -> ${to}`);
  }
  return to;
}
