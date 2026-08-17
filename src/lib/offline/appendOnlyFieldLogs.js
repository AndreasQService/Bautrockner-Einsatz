import { v4 as uuidv4 } from 'uuid';
import * as DeviceLocalStore from '../../services/DeviceLocalStore.js';
import { createOfflineTransaction } from './transactionStore.js';
import { triggerOfflineOutboxSync } from './outboxWorker.js';

/**
 * Append-only Field Log Generator for Technicians (Offline-First)
 * Writes immediately to local IndexedDB before any network transmission.
 */

export async function logFieldMeasurement({ projectId, userId, roomId, roomName, pointName, wValue, bValue, notes }) {
  const logId = uuidv4();
  const timestamp = new Date().toISOString();

  const entry = {
    id: logId,
    projectId,
    userId: String(userId || 'technician').trim(),
    roomId,
    roomName: roomName || 'Raum',
    pointName: pointName || 'Messpunkt',
    wValue: String(wValue || ''),
    bValue: String(bValue || ''),
    notes: notes || '',
    created_at: timestamp
  };

  // 1. Save to local IndexedDB/LocalStorage draft
  await DeviceLocalStore.saveSnapshot(projectId, userId, {
    lastFieldMeasurement: entry,
    version: Date.now()
  });

  // 2. Queue for asynchronous background retry sync
  await createOfflineTransaction({
    projectId,
    snapshot: { lastFieldMeasurement: entry },
    operations: [{
      type: 'field_log.measurement.insert',
      entityId: logId,
      payload: entry
    }]
  }).catch(err => console.warn('[FieldLogs] Outbox queue notice:', err));

  triggerOfflineOutboxSync('field_measurement');

  return entry;
}

export async function logFieldEquipmentChange({ projectId, userId, deviceId, deviceName, status, notes }) {
  const logId = uuidv4();
  const timestamp = new Date().toISOString();

  const entry = {
    id: logId,
    projectId,
    userId: String(userId || 'technician').trim(),
    deviceId,
    deviceName: deviceName || 'Gerät',
    status: status || 'active',
    notes: notes || '',
    created_at: timestamp
  };

  await DeviceLocalStore.saveSnapshot(projectId, userId, {
    lastEquipmentLog: entry,
    version: Date.now()
  });

  await enqueueOutboxOperation({
    type: 'field_log.equipment.insert',
    projectId,
    entityId: logId,
    payload: entry
  }).catch(err => console.warn('[FieldLogs] Outbox queue notice:', err));

  return entry;
}

export async function logFieldPhotoUpload({ projectId, userId, photoId, name, checksum, storagePath }) {
  const logId = photoId || uuidv4();
  const timestamp = new Date().toISOString();

  const entry = {
    id: logId,
    projectId,
    userId: String(userId || 'technician').trim(),
    name: name || 'Foto',
    checksum: checksum || '',
    storagePath: storagePath || '',
    created_at: timestamp
  };

  await DeviceLocalStore.saveSnapshot(projectId, userId, {
    lastPhotoLog: entry,
    version: Date.now()
  });

  await enqueueOutboxOperation({
    type: 'field_log.photo.insert',
    projectId,
    entityId: logId,
    payload: entry
  }).catch(err => console.warn('[FieldLogs] Outbox queue notice:', err));

  return entry;
}
