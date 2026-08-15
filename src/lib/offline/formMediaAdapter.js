import { OFFLINE_STATES, getOfflineBlob, registerLocalMutation, setOperationStatus } from './index.js';
import { prepareImageForDurableStorage } from './imagePipeline.js';
import { sha256OfBlob } from '../uploads/hash.js';
import { hasActiveProjectSession } from './projectSessionStore.js';
import { buildTestRemotePath } from '../uploads/oneDrivePathBuilder.js';
import { validateTestRunId } from '../uploads/oneDriveTestGuard.js';

const safeProjectId = (value) => {
  if (value) return String(value);
  throw new TypeError('projectId muss vor lokaler Registrierung stabil vergeben sein');
};

const safeSegment = (value) => String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');

const storageTarget = ({ projectId, kind, entityId, name }) => {
  const folder = kind === 'measurement_protocol'
    ? 'protocols'
    : kind === 'case_document'
      ? 'original'
      : 'images';
  const testRunId = import.meta.env.VITE_ONEDRIVE_TEST_RUN_ID;
  const subfolder = kind === 'measurement_protocol'
    ? 'Messprotokolle'
    : kind === 'case_document' ? 'Dokumente' : 'Fotos';
  const remotePath = validateTestRunId(testRunId)
    ? buildTestRemotePath({ testRunId, projectId, subfolder, originalFileName: name || `${entityId}.bin` })
    : null;
  return {
    provider: 'supabase-storage',
    bucket: 'case-files',
    path: `cases/${safeSegment(projectId)}/${folder}/${safeSegment(entityId)}_${safeSegment(name)}`,
    projectId: String(projectId),
    entityId: String(entityId),
    kind,
    remotePath,
  };
};

export async function registerMediaLocally({
  projectId,
  projectSnapshot,
  entityId,
  kind = 'image',
  file,
  payload = {},
  actor = null,
  device = null,
  baseVersion = null,
}) {
  if (!(file instanceof Blob)) throw new TypeError('file muss ein Blob sein');
  const isImage = String(file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name || '');
  const prepared = isImage ? await prepareImageForDurableStorage(file) : {
    file,
    checksum: await sha256OfBlob(file),
    width: null,
    height: null,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    sourceSize: file.size,
  };
  const durableFile = prepared.file;
  const id = String(entityId || `media_${crypto.randomUUID()}`);
  const target = storageTarget({ projectId: safeProjectId(projectId), kind, entityId: id, name: durableFile.name || payload.name });
  const manifest = await registerLocalMutation({
    projectId: safeProjectId(projectId),
    type: `media.${kind}.upsert`,
    entityId: id,
    payload: {
      ...payload,
      entityId: id,
      kind,
      cloudTarget: target,
      association: { projectId: safeProjectId(projectId), entityId: id },
      localMedia: {
        checksum: prepared.checksum,
        width: prepared.width,
        height: prepared.height,
        size: prepared.size,
        mimeType: prepared.mimeType,
        sourceSize: prepared.sourceSize,
        originalPersisted: false,
      },
    },
    snapshot: projectSnapshot,
    blob: {
      blob: durableFile,
      kind,
      entityId: id,
      name: durableFile.name || payload.name || `${id}.bin`,
      checksum: prepared.checksum,
    },
    actor,
    device,
    baseVersion,
    idempotencyKey: `${safeProjectId(projectId)}:${kind}:${id}`,
  });
  const stored = await getOfflineBlob(manifest.blobIds[0]);
  if (!stored?.blob || stored.size !== prepared.size || stored.checksum !== prepared.checksum) {
    throw new Error('Atomare lokale Medienverifikation fehlgeschlagen');
  }
  return { ...manifest, cloudTarget: target, localFile: durableFile, localMedia: prepared };
}

export async function registerCaseDocumentLocally({
  projectId,
  projectSnapshot,
  entityId,
  file,
  fileType,
  actor = null,
  device = null,
  baseVersion = null,
}) {
  return registerMediaLocally({
    projectId,
    projectSnapshot,
    entityId: entityId || `document_${crypto.randomUUID()}`,
    kind: 'case_document',
    file,
    payload: {
      name: file?.name || 'document',
      originalFilename: file?.name || 'document',
      fileType: fileType || 'document',
      extractionStatus: 'pending',
    },
    actor,
    device,
    baseVersion,
  });
}

export async function registerMeasurementLocally({
  projectId,
  projectSnapshot,
  roomId,
  measurementId = null,
  measurement,
  protocolFile = null,
  actor = null,
  device = null,
  baseVersion = null,
}) {
  const entityId = String(measurementId || `measurement_${crypto.randomUUID()}`);
  const protocolIsImage = protocolFile instanceof Blob && (
    String(protocolFile.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(protocolFile.name || '')
  );
  const preparedProtocol = protocolIsImage ? await prepareImageForDurableStorage(protocolFile) : null;
  const durableProtocol = preparedProtocol?.file || protocolFile;
  const protocolChecksum = durableProtocol instanceof Blob
    ? (preparedProtocol?.checksum || await sha256OfBlob(durableProtocol))
    : null;
  const target = durableProtocol instanceof Blob ? storageTarget({
    projectId: safeProjectId(projectId),
    kind: 'measurement_protocol',
    entityId,
    name: durableProtocol.name || `${entityId}.bin`,
  }) : null;
  const blobs = durableProtocol instanceof Blob ? [{
    blob: durableProtocol,
    kind: 'measurement_protocol',
    entityId,
    name: durableProtocol.name || `${entityId}.bin`,
    checksum: protocolChecksum,
  }] : [];

  const manifest = await registerLocalMutation({
    projectId: safeProjectId(projectId),
    type: 'measurement.upsert',
    entityId,
    payload: {
      ...measurement,
      cloudTarget: target,
      association: { projectId: safeProjectId(projectId), roomId: roomId || null, measurementId: entityId },
      ...(preparedProtocol ? { localMedia: { ...preparedProtocol, file: undefined, originalPersisted: false } } : {}),
    },
    snapshot: projectSnapshot,
    blobs,
    actor,
    device,
    baseVersion,
    idempotencyKey: `${safeProjectId(projectId)}:measurement:${entityId}:${measurement?.globalSettings?.date || 'draft'}`,
  });
  if (preparedProtocol) {
    const stored = await getOfflineBlob(manifest.blobIds[0]);
    if (!stored?.blob || stored.size !== preparedProtocol.size || stored.checksum !== preparedProtocol.checksum) {
      throw new Error('Lokale Messbildverifikation fehlgeschlagen');
    }
  }
  return { ...manifest, cloudTarget: target };
}

/** Netzwerk darf ausschliesslich nach einem bestaetigten lokalen Commit starten. */
export async function runCloudAfterLocal(localManifest, cloudAction) {
  if (!localManifest?.localConfirmedAt) {
    throw new Error('Cloud-Synchronisierung ohne bestaetigten lokalen Commit blockiert');
  }
  if (typeof cloudAction !== 'function') return null;
  const operationId = localManifest.operationIds?.[0];
  if (!operationId) throw new Error('Lokaler Commit enthält keinen Outbox-Auftrag');
  // Während einer geöffneten Offline-Sitzung ist dieser frühere Fast-Path
  // ausdrücklich deaktiviert. Der zentrale Abschlussorchestrator verarbeitet
  // denselben langlebigen Outbox-Auftrag später mit Besitzer-Token.
  if (await hasActiveProjectSession()) return null;
  await setOperationStatus(operationId, OFFLINE_STATES.UPLOADING);
  try {
    const result = await cloudAction();
    // Ein erfolgreicher Storage-Upload bestaetigt noch nicht die zugehoerige
    // Projekt-/Raum-Zuordnung in der Datenbank. Daher bleibt der Auftrag fuer
    // den zentralen Projekt-Sync ausstehend und darf noch nicht gruen werden.
    await setOperationStatus(operationId, OFFLINE_STATES.QUEUED);
    return result;
  } catch (error) {
    await setOperationStatus(operationId, OFFLINE_STATES.FAILED, { error });
    throw error;
  }
}
