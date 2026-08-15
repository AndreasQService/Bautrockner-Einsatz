import { registerOutboxHandler } from './outboxWorker.js';

export async function sha256Hex(blob) {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function queueOneDriveTransfer(supabase, {
  projectId, entityId, filename, mimeType, size, checksum, bucket, path, remotePath,
}) {
  if (!projectId || !entityId || !remotePath || !/^[a-f0-9]{64}$/i.test(String(checksum || ''))) {
    throw Object.assign(new Error('OneDrive-Transferauftrag ohne Projekt, Entity, Zielpfad oder SHA-256'), { retryable: false });
  }
  // Any byte/hash change invalidates every previous remote proof atomically.
  // The worker consumes exactly uploaded_to_backend/needs_repair.
  const pending = {
    project_id: projectId,
    local_image_id: entityId,
    filename: filename || `${entityId}.bin`,
    mime_type: mimeType || 'application/octet-stream',
    size_bytes: size,
    sha256: String(checksum).toLowerCase(),
    storage_bucket: bucket,
    storage_path: path,
    remote_path: remotePath,
    storage_status: 'uploaded_to_backend',
    remote_drive_id: null,
    remote_item_id: null,
    remote_etag: null,
    remote_size_bytes: null,
    remote_sha256: null,
    verified_at: null,
    last_error: null,
  };
  const { data, error } = await supabase.from('project_image_uploads')
    .upsert(pending, { onConflict: 'local_image_id' })
    .select('project_id,local_image_id,storage_path,remote_path,storage_status,size_bytes,sha256,remote_drive_id,remote_item_id,remote_etag,remote_size_bytes,remote_sha256,verified_at')
    .single();
  if (error) throw error;
  const staleProof = data?.remote_drive_id || data?.remote_item_id || data?.remote_etag
    || data?.remote_size_bytes != null || data?.remote_sha256 || data?.verified_at;
  if (String(data?.project_id) !== String(projectId)
    || String(data?.local_image_id) !== String(entityId)
    || data?.storage_status !== 'uploaded_to_backend'
    || data?.storage_path !== path || data?.remote_path !== remotePath
    || Number(data?.size_bytes) !== Number(size)
    || String(data?.sha256 || '').toLowerCase() !== String(checksum).toLowerCase()
    || staleProof) {
    throw Object.assign(new Error('OneDrive-Warteschlange oder Evidenz-Invalidierung stimmt im Readback nicht'), { retryable: true });
  }
  return data;
}

export async function verifyOneDriveCopy(supabase, entityId, expectedChecksum, expectedSize, expectedProjectId) {
  if (supabase.functions?.invoke) {
    const { error: triggerError } = await supabase.functions.invoke('onedrive-upload-worker', { body: {} });
    if (triggerError) throw Object.assign(triggerError, { retryable: true });
  }
  const { data: journal, error } = await supabase
    .from('project_image_uploads')
    .select('project_id,local_image_id,storage_status,remote_path,remote_drive_id,remote_item_id,remote_etag,remote_size_bytes,remote_sha256,verified_at')
    .eq('local_image_id', entityId)
    .maybeSingle();
  if (error) throw error;
  if (!journal?.remote_item_id || journal.storage_status !== 'remote_verified') {
    throw Object.assign(new Error('OneDrive-Endbestätigung steht noch aus'), { retryable: true });
  }
  const complete = journal.remote_drive_id && journal.remote_etag && journal.verified_at
    && Number(journal.remote_size_bytes) === Number(expectedSize)
    && String(journal.remote_sha256 || '').toLowerCase() === String(expectedChecksum || '').toLowerCase()
    && String(journal.local_image_id || '') === String(entityId)
    && (!expectedProjectId || String(journal.project_id || '') === String(expectedProjectId));
  if (!complete) {
    throw Object.assign(new Error('OneDrive Drive-/Projekt-/Entity-/ETag-/Grössen-/SHA-Evidenz ist unvollständig oder abweichend'), { retryable: true });
  }
  return {
    itemId: journal.remote_item_id,
    driveId: journal.remote_drive_id,
    eTag: journal.remote_etag,
    path: journal.remote_path,
    size: Number(journal.remote_size_bytes),
    checksum: String(journal.remote_sha256).toLowerCase(),
    verifiedAt: journal.verified_at,
  };
}

function containsAssociation(value, entityId, path) {
  if (value == null) return false;
  if (typeof value === 'string') return value === entityId || value === path || value.includes(path);
  if (Array.isArray(value)) return value.some((entry) => containsAssociation(entry, entityId, path));
  if (typeof value === 'object') return Object.values(value)
    .some((entry) => containsAssociation(entry, entityId, path));
  return false;
}

function markMediaConfirmed(value, entityId, path, oneDrive = null) {
  if (Array.isArray(value)) {
    let found = false;
    const next = value.map((entry) => {
      const result = markMediaConfirmed(entry, entityId, path, oneDrive);
      found ||= result.found;
      return result.value;
    });
    return { value: next, found };
  }
  if (!value || typeof value !== 'object') return { value, found: false };
  const isEntity = String(value.id || value.entityId || '') === String(entityId);
  if (isEntity) {
    return {
      found: true,
      value: {
        ...value,
        storagePath: path,
        supabasePath: path,
        syncStatus: 'cloud_confirmed',
        supabaseBackedUpAt: new Date().toISOString(),
        oneDriveItemId: oneDrive?.itemId || value.oneDriveItemId || null,
        oneDrivePath: oneDrive?.path || value.oneDrivePath || null,
        oneDriveSha256: oneDrive?.checksum || value.oneDriveSha256 || null,
        oneDriveVerifiedAt: oneDrive ? new Date().toISOString() : value.oneDriveVerifiedAt || null,
      },
    };
  }
  let found = false;
  const next = Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    const result = markMediaConfirmed(entry, entityId, path, oneDrive);
    found ||= result.found;
    return [key, result.value];
  }));
  return { value: next, found };
}

function hasConfirmedMedia(value, entityId, path) {
  if (!value || typeof value !== 'object') return false;
  if (String(value.id || value.entityId || '') === String(entityId)) {
    return value.storagePath === path && value.syncStatus === 'cloud_confirmed';
  }
  return Object.values(value).some((entry) => hasConfirmedMedia(entry, entityId, path));
}

export function registerSupabaseMediaOutboxHandlers(supabase) {
  if (!supabase?.storage) throw new TypeError('Supabase-Client mit Storage ist erforderlich');

  const handler = async ({ operation, blob }) => {
    const target = operation.payload?.cloudTarget;
    if (!target?.bucket || !target?.path || !blob?.blob) {
      throw Object.assign(new Error('Medienauftrag ohne Bucket, Pfad oder lokalen Blob'), { retryable: false });
    }

    const { error: uploadError } = await supabase.storage
      .from(target.bucket)
      .upload(target.path, blob.blob, { upsert: true, contentType: blob.mimeType });
    if (uploadError) throw uploadError;

    const { data: downloaded, error: readbackError } = await supabase.storage
      .from(target.bucket)
      .download(target.path);
    if (readbackError || !downloaded) throw readbackError || new Error('Storage-Readback fehlt');
    if (downloaded.size !== blob.size) {
      throw Object.assign(new Error(`Storage-Grösse stimmt nicht: ${downloaded.size}/${blob.size}`), { retryable: true });
    }

    if (!blob.checksum) {
      throw Object.assign(new Error('Lokale Medien-Prüfsumme fehlt'), { retryable: false });
    }
    const checksum = await sha256Hex(downloaded);
    if (checksum.toLowerCase() !== String(blob.checksum).toLowerCase()) {
      throw Object.assign(new Error('Storage-Prüfsumme stimmt nicht'), { retryable: true });
    }

    const projectId = operation.payload?.association?.projectId || target.projectId;
    if (operation.payload?.kind === 'case_document') {
      const documentRow = {
        case_id: projectId,
        file_path: target.path,
        file_type: operation.payload?.fileType || 'document',
        original_filename: operation.payload?.originalFilename || blob.name,
        extraction_status: operation.payload?.extractionStatus || 'pending',
      };
      const { data: existing, error: existingError } = await supabase
        .from('case_documents')
        .select('id,file_path,case_id,extraction_status')
        .eq('file_path', target.path)
        .maybeSingle();
      if (existingError) throw existingError;
      let documentId = existing?.id;
      if (!documentId) {
        const { data: inserted, error: insertError } = await supabase
          .from('case_documents')
          .insert(documentRow)
          .select('id')
          .single();
        if (insertError) throw insertError;
        documentId = inserted.id;
      }
      const { data: verifiedDocument, error: documentError } = await supabase
        .from('case_documents')
        .select('id,file_path,case_id,extraction_status')
        .eq('id', documentId)
        .single();
      if (documentError) throw documentError;
      if (String(verifiedDocument.case_id) !== String(projectId) || verifiedDocument.file_path !== target.path) {
        throw Object.assign(new Error('Dokumentzuordnung im Cloud-Readback stimmt nicht'), { retryable: true });
      }
      if (supabase.functions?.invoke && verifiedDocument.extraction_status === 'pending') {
        const { error: extractionError } = await supabase.functions.invoke('extract', {
          body: { document_id: documentId },
        });
        if (extractionError) throw extractionError;
      }
      const documentEntityId = operation.payload?.association?.entityId || operation.entityId || documentId;
      // Falldokumente use the same durable transfer journal as images and
      // protocols. Without this row the worker cannot produce attributable
      // OneDrive evidence and the operation must never become verified.
      await queueOneDriveTransfer(supabase, {
        projectId, entityId: documentEntityId,
        filename: operation.payload?.originalFilename || blob.name,
        mimeType: blob.mimeType, size: downloaded.size, checksum,
        bucket: target.bucket, path: target.path, remotePath: target.remotePath,
      });
      const oneDrive = await verifyOneDriveCopy(supabase, documentEntityId, checksum, downloaded.size, projectId);
      return {
        verified: true,
        evidence: {
          provider: target.provider,
          bucket: target.bucket,
          path: target.path,
          size: downloaded.size,
          checksum,
          documentId,
          oneDrive,
          association: { projectId, documentId },
          verifiedAt: new Date().toISOString(),
        },
      };
    }
    const entityId = operation.payload?.association?.entityId || operation.payload?.association?.measurementId || target.entityId;
    await queueOneDriveTransfer(supabase, {
      projectId, entityId, filename: blob.name, mimeType: blob.mimeType,
      size: downloaded.size, checksum, bucket: target.bucket, path: target.path,
      remotePath: target.remotePath,
    });
    // Keine Cloud-/UI-Bestätigung bevor dieselben Bytes auch aus OneDrive
    // zurückgelesen und per Grösse + SHA-256 verifiziert wurden.
    const oneDrive = await verifyOneDriveCopy(supabase, entityId, checksum, downloaded.size, projectId);
    const { data: projectRow, error: projectError } = await supabase
      .from('damage_reports')
      .select('id, report_data')
      .eq('id', projectId)
      .maybeSingle();
    if (projectError) throw projectError;
    if (!projectRow || !containsAssociation(projectRow.report_data, entityId, target.path)) {
      throw Object.assign(new Error('Storage bestätigt, aber Projekt-/Messungszuordnung noch nicht in DB verifiziert'), {
        retryable: true,
      });
    }
    const confirmedReport = markMediaConfirmed(projectRow.report_data, entityId, target.path, oneDrive);
    if (!confirmedReport.found) {
      throw Object.assign(new Error('Medienobjekt fehlt in der Projektzuordnung'), { retryable: true });
    }
    const { error: associationError } = await supabase
      .from('damage_reports')
      .update({ report_data: confirmedReport.value })
      .eq('id', projectId);
    if (associationError) throw associationError;
    const { data: associationReadback, error: associationReadbackError } = await supabase
      .from('damage_reports')
      .select('report_data')
      .eq('id', projectId)
      .single();
    if (associationReadbackError) throw associationReadbackError;
    if (!hasConfirmedMedia(associationReadback.report_data, entityId, target.path)) {
      throw Object.assign(new Error('Bestätigte Medienzuordnung fehlt im finalen Readback'), { retryable: true });
    }
    return {
      verified: true,
      evidence: {
        provider: target.provider,
        bucket: target.bucket,
        path: target.path,
        size: downloaded.size,
          checksum,
          oneDrive,
        association: operation.payload?.association || null,
        verifiedAt: new Date().toISOString(),
      },
    };
  };

  const unregisterMedia = registerOutboxHandler('media.*', handler);
  return () => {
    unregisterMedia();
  };
}
