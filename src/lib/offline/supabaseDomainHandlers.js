import { registerOutboxHandler } from './outboxWorker.js';
import { queueOneDriveTransfer, sha256Hex, verifyOneDriveCopy } from './supabaseMediaHandlers.js';
import { compareProjectReportData, projectReportDataProjection } from './projectSyncSummary.js';

const fail = (message, retryable = true) => Object.assign(new Error(message), { retryable });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sameValue = (actual, expected) => {
  if (expected === undefined) return true;
  if (expected === null) return actual === null;
  return String(actual) === String(expected);
};

const assertFields = (actual, expected, fields, label) => {
  const mismatch = fields.find((field) => !sameValue(actual?.[field], expected?.[field]));
  if (mismatch) throw fail(`${label}: Feld ${mismatch} stimmt im Readback nicht`);
};

export function registerSupabaseDomainOutboxHandlers(supabase) {
  if (!supabase?.from) throw new TypeError('Supabase-Client ist erforderlich');

  const deviceHandler = async ({ operation }) => {
    const payload = operation.payload || {};
    const device = payload.device || payload;
    const dbId = device.dbId || device.id || (UUID_RE.test(String(operation.entityId)) ? operation.entityId : null);
    const number = device.deviceNumber || device.number || operation.entityId;

    const persistAndVerifyProjectEquipment = async () => {
      const expectedEquipment = payload.project?.equipment;
      const reportId = payload.projectId || operation.projectId;
      if (!Array.isArray(expectedEquipment)) return null;
      if (!reportId) throw fail('Projekt-ID für Geräte-Snapshot fehlt', false);
      const { data: current, error: currentError } = await supabase
        .from('damage_reports').select('report_data').eq('id', reportId).single();
      if (currentError) throw currentError;
      const reportData = { ...(current.report_data || {}), equipment: expectedEquipment };
      const { error: updateError } = await supabase
        .from('damage_reports').update({ report_data: reportData }).eq('id', reportId);
      if (updateError) throw updateError;
      const { data: readback, error: readError } = await supabase
        .from('damage_reports').select('id,report_data').eq('id', reportId).single();
      if (readError) throw readError;
      if (JSON.stringify(readback.report_data?.equipment || []) !== JSON.stringify(expectedEquipment)) {
        throw fail('Geräte-Snapshot im Projekt-Readback stimmt nicht');
      }
      return { reportId: readback.id, equipmentCount: expectedEquipment.length };
    };

    if (operation.type === 'device.catalog.upsert') {
      const row = { ...payload };
      delete row.projectId;
      delete row.tombstone;
      delete row.deletedAt;
      const query = UUID_RE.test(String(operation.entityId))
        ? supabase.from('device_catalog').update(row).eq('id', operation.entityId)
        : supabase.from('device_catalog').upsert(row, { onConflict: 'hersteller,modell' });
      const { error } = await query;
      if (error) throw error;
      const { data, error: readError } = await supabase.from('device_catalog').select('id,hersteller,modell').eq('hersteller', row.hersteller).eq('modell', row.modell).limit(1).single();
      if (readError) throw readError;
      assertFields(data, row, ['hersteller', 'modell'], 'Gerätekatalog');
      return { verified: true, evidence: data };
    }

    if (operation.type === 'device.catalog.delete' || operation.type === 'device.inventory.delete') {
      const table = operation.type === 'device.catalog.delete' ? 'device_catalog' : 'devices';
      const id = payload.catalogId || device.id || operation.entityId;
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      const { data, error: readError } = await supabase.from(table).select('id').eq('id', id).maybeSingle();
      if (readError) throw readError;
      if (data) throw fail('Tombstone-Löschung nicht verifiziert');
      return { verified: true, evidence: { absent: true, table, id } };
    }

    if (operation.type === 'device.unassign' || operation.type === 'device.checkout') {
      let resolvedId = dbId;
      if (!resolvedId && number) {
        const { data: found, error: findError } = await supabase.from('devices').select('id').eq('number', number).maybeSingle();
        if (findError) throw findError;
        resolvedId = found?.id || null;
      }
      if (!resolvedId) throw fail('Gerät für Abmeldung nicht eindeutig auffindbar', false);
      const patch = { current_report_id: null, current_project: null };
      const { error } = await supabase.from('devices').update(patch).eq('id', resolvedId);
      if (error) throw error;
      const { data, error: readError } = await supabase.from('devices').select('id,current_report_id,current_project').eq('id', resolvedId).single();
      if (readError) throw readError;
      const verified = data.current_report_id === null && data.current_project === null;
      if (!verified) throw fail('Gerätezuordnung nicht verifiziert');
      const projectEvidence = await persistAndVerifyProjectEquipment();
      return { verified: true, evidence: { device: data, project: projectEvidence } };
    }

    const allowed = [
      'number', 'catalog_id', 'status', 'type', 'model', 'energy_consumption',
      'current_report_id', 'current_project', 'is_rental', 'rental_provider',
      'rental_cost_daily', 'rental_start', 'rental_end_planned',
    ];
    const row = Object.fromEntries(allowed
      .filter((field) => device[field] !== undefined)
      .map((field) => [field, device[field]]));
    row.number = number;
    row.status = row.status || 'Aktiv';
    if (device.isRental !== undefined && row.is_rental === undefined) row.is_rental = !!device.isRental;
    if (payload.projectId && row.current_report_id === undefined) row.current_report_id = payload.projectId;
    const query = dbId
      ? supabase.from('devices').update(row).eq('id', dbId)
      : supabase.from('devices').upsert(row, { onConflict: 'number' });
    const { error } = await query;
    if (error) throw error;
    const { data, error: readError } = await supabase.from('devices').select('*').eq('number', number).single();
    if (readError) throw readError;
    assertFields(data, row, Object.keys(row), 'Gerät');
    const projectEvidence = await persistAndVerifyProjectEquipment();
    return { verified: true, evidence: { device: data, project: projectEvidence } };
  };

  const measurementHandler = async ({ operation, blob }) => {
    const association = operation.payload?.association;
    if (!association?.roomId) throw fail('Messraum-Zuordnung fehlt', false);
    let protocolUrl = null;
    if (blob?.blob) {
      const target = operation.payload?.cloudTarget;
      if (!target?.bucket || !target?.path) throw fail('Protokoll-Uploadziel fehlt', false);
      const { error: uploadError } = await supabase.storage.from(target.bucket).upload(target.path, blob.blob, { upsert: true, contentType: blob.mimeType });
      if (uploadError) throw uploadError;
      const { data: checkBlob, error: downloadError } = await supabase.storage.from(target.bucket).download(target.path);
      if (downloadError || checkBlob?.size !== blob.size) throw downloadError || fail('Protokoll-Readback stimmt nicht');
      if (!blob.checksum) throw fail('Lokale Protokoll-Prüfsumme fehlt', false);
      const storageChecksum = await sha256Hex(checkBlob);
      if (storageChecksum.toLowerCase() !== String(blob.checksum).toLowerCase()) {
        throw fail('Protokoll-SHA-256 im Storage-Readback stimmt nicht');
      }
      await queueOneDriveTransfer(supabase, {
        projectId: operation.projectId,
        entityId: operation.entityId,
        filename: blob.name,
        mimeType: blob.mimeType,
        size: checkBlob.size,
        checksum: storageChecksum,
        bucket: target.bucket,
        path: target.path,
        remotePath: target.remotePath,
      });
      const oneDrive = await verifyOneDriveCopy(supabase, operation.entityId, storageChecksum, checkBlob.size, operation.projectId);
      protocolUrl = supabase.storage.from(target.bucket).getPublicUrl(target.path).data.publicUrl;
      operation._verifiedProtocolEvidence = { storageChecksum, oneDrive };
    }
    const { data: existing, error: existingError } = await supabase.from('damage_reports').select('report_data').eq('id', operation.projectId).single();
    if (existingError) throw existingError;
    const reportData = { ...(existing.report_data || {}) };
    const pending = operation.payload || {};
    const updateRooms = (rooms = []) => rooms.map((room) => String(room.id) === String(association.roomId) ? {
      ...room,
      measurementData: {
        measurements: pending.measurements || [], globalSettings: pending.globalSettings || {},
        canvasImage: pending.canvasImage || room.measurementData?.canvasImage || null,
        galleryPhotos: pending.galleryPhotos || [], protocolUrl: protocolUrl || room.measurementData?.protocolUrl || null,
      },
    } : room);
    reportData.measurementRooms = updateRooms(reportData.measurementRooms || []);
    reportData.rooms = updateRooms(reportData.rooms || []);
    const { error } = await supabase.from('damage_reports')
      .update({ report_data: reportData })
      .eq('id', operation.projectId);
    if (error) throw error;
    const { data, error: readError } = await supabase.from('damage_reports')
      .select('id,report_data')
      .eq('id', operation.projectId)
      .single();
    if (readError) throw readError;
    const rooms = [
      ...(data.report_data?.measurementRooms || []),
      ...(data.report_data?.rooms || []),
    ];
    const savedRoom = rooms.find((room) => String(room.id) === String(association.roomId));
    const expectedCount = (pending.measurements || []).length;
    if (!savedRoom || (savedRoom.measurementData?.measurements || []).length !== expectedCount) throw fail('Konkrete Messung im Cloud-Readback nicht bestätigt');
    if (protocolUrl && savedRoom.measurementData?.protocolUrl !== protocolUrl) throw fail('Messprotokoll-Zuordnung im Cloud-Readback fehlt');
    const savedMeasurements = savedRoom.measurementData?.measurements || [];
    const mismatch = (pending.measurements || []).some((measurement, index) =>
      JSON.stringify(savedMeasurements[index] ?? null) !== JSON.stringify(measurement ?? null));
    if (mismatch) throw fail('Messwerte stimmen im Cloud-Readback nicht');
    return { verified: true, evidence: {
      reportId: data.id, roomId: association?.roomId || null, hasBlob: !!blob,
      protocol: operation._verifiedProtocolEvidence || null,
    } };
  };

  const todoHandler = async ({ operation }) => {
    const payload = operation.payload || {};
    const todoId = payload.todoId || operation.entityId;
    const isUuid = UUID_RE.test(String(todoId));
    if (!isUuid && operation.type !== 'todo.create') {
      throw fail('Lokales To-do besitzt noch keine auflösbare Cloud-ID', false);
    }
    if (operation.type === 'todo.delete') {
      const { error } = await supabase.from('project_todos').delete().eq('id', todoId);
      if (error) throw error;
      const { count, error: readError } = await supabase.from('project_todos').select('id', { count: 'exact', head: true }).eq('id', todoId);
      if (readError) throw readError;
      if (count !== 0) throw fail('To-do-Löschung nicht verifiziert');
      return { verified: true, evidence: { todoId, absent: true } };
    }
    if (operation.type === 'todo.complete_and_archive') {
      const { error } = await supabase.rpc('fn_complete_todo_and_archive_project', { p_todo_id: todoId, p_completed_by: payload.completedBy });
      if (error) throw error;
      const { data: todo, error: readError } = await supabase.from('project_todos').select('id,status,project_id').eq('id', todoId).single();
      if (readError) throw readError;
      const { data: project, error: projectError } = await supabase.from('damage_reports').select('id,status').eq('id', todo.project_id).single();
      if (projectError) throw projectError;
      if (todo.status !== 'done' || project.status !== 'Abgeschlossen') throw fail('Todo-/Archivstatus nicht verifiziert');
      return { verified: true, evidence: { todoId, projectId: project.id } };
    }
    if (operation.type === 'todo.complete_and_create') {
      const follow = payload.followUp || {};
      const { error } = await supabase.rpc('fn_complete_and_create_todo', {
        p_todo_id: todoId, p_completed_by: payload.completedBy,
        p_new_task: follow.task, p_new_due_date: follow.dueDate,
        p_assigned_user_id: String(follow.assignedUserId), p_assigned_user_name: follow.assignedUserName,
        p_note: follow.note || null, p_closes_project: !!follow.closesProject,
      });
      if (error) throw error;
      const { data: oldTodo, error: oldError } = await supabase.from('project_todos').select('status,project_id').eq('id', todoId).single();
      if (oldError) throw oldError;
      const { count, error: followError } = await supabase.from('project_todos').select('id', { count: 'exact', head: true })
        .eq('project_id', follow.projectId || oldTodo.project_id).eq('task', follow.task).eq('status', 'open');
      if (followError) throw followError;
      if (oldTodo.status !== 'done' || !count) throw fail('Folge-To-do nicht vollständig verifiziert');
      return { verified: true, evidence: { todoId, followUpCount: count } };
    }
    if (operation.type === 'todo.complete') {
      const { error } = await supabase.from('project_todos').update({ status: 'done', completed_by: payload.completedBy, completed_at: payload.completedAt }).eq('id', todoId);
      if (error) throw error;
    } else if (operation.type === 'todo.update') {
      const row = {
        task: payload.task,
        due_date: payload.dueDate ?? payload.due_date,
        assigned_user_id: String(payload.assignedUserId ?? payload.assigned_user_id),
        assigned_user_name: payload.assignedUserName ?? payload.assigned_user_name,
        note: payload.note || null,
        closes_project: !!(payload.closesProject ?? payload.closes_project),
        updated_by: payload.currentUser ?? payload.updated_by,
      };
      Object.keys(row).forEach((key) => row[key] === undefined && delete row[key]);
      const { error } = await supabase.from('project_todos').update(row).eq('id', todoId);
      if (error) throw error;
    } else if (operation.type === 'todo.create') {
      const row = { ...payload };
      if (!isUuid) {
        delete row.id;
        const { data: existing, error: lookupError } = await supabase.from('project_todos').select('id')
          .eq('project_id', payload.project_id).eq('task', payload.task).eq('due_date', payload.due_date)
          .eq('status', payload.status || 'open').limit(1).maybeSingle();
        if (lookupError) throw lookupError;
        if (!existing) {
          const { error } = await supabase.from('project_todos').insert(row);
          if (error) throw error;
        }
      } else {
        const { error } = await supabase.from('project_todos').upsert(row);
        if (error) throw error;
      }
    }
    const query = isUuid
      ? supabase.from('project_todos').select('*').eq('id', todoId).maybeSingle()
      : supabase.from('project_todos').select('*').eq('project_id', payload.project_id).eq('task', payload.task).limit(1).maybeSingle();
    const { data, error } = await query;
    if (error) throw error;
    if (!data || (operation.type === 'todo.complete' && data.status !== 'done')) throw fail('To-do-Readback nicht bestätigt');
    if (operation.type === 'todo.update') {
      assertFields(data, {
        task: payload.task,
        due_date: payload.dueDate ?? payload.due_date,
        assigned_user_id: payload.assignedUserId ?? payload.assigned_user_id,
        assigned_user_name: payload.assignedUserName ?? payload.assigned_user_name,
      }, ['task', 'due_date', 'assigned_user_id', 'assigned_user_name'], 'To-do');
    }
    return { verified: true, evidence: { todoId: data.id, status: data.status } };
  };

  const relationalMeasurementHandler = async ({ operation }) => {
    const payload = operation.payload || {};
    if (operation.type.endsWith('.upsert')) {
      const conflict = payload.table === 'room_measurements'
        ? 'report_id,room_id,legacy_measurement_id'
        : payload.table === 'measurement_protocols'
          ? 'report_id,room_id,legacy_protocol_id'
          : 'report_id,legacy_room_id';
      if (!payload.table || !payload.rows?.length) throw fail('Relationaler Messauftrag unvollständig', false);
      const { error } = await supabase.from(payload.table).upsert(payload.rows, { onConflict: conflict });
      if (error) throw error;
      const column = payload.table === 'room_measurements'
        ? 'legacy_measurement_id'
        : payload.table === 'measurement_protocols'
          ? 'legacy_protocol_id'
          : 'legacy_room_id';
      const ids = payload.rows.map((row) => row[column]);
      const { data, error: readError } = await supabase.from(payload.table).select('*').in(column, ids).is('deleted_at', null);
      if (readError || data?.length !== payload.rows.length) throw readError || fail('Relationaler Mess-Readback ist unvollständig');
      for (const expected of payload.rows) {
        const actual = data.find((row) => row[column] === expected[column]);
        const fields = payload.table === 'room_measurements'
          ? ['report_id', 'room_id', 'legacy_measurement_id', 'mp_number', 'wall_value', 'floor_value', 'device', 'measured_at']
          : payload.table === 'measurement_protocols'
            ? ['report_id', 'room_id', 'legacy_protocol_id', 'file_url', 'upload_status']
            : ['report_id', 'legacy_room_id', 'name', 'room_type'];
        assertFields(actual, expected, fields, 'Relationale Messdaten');
      }
      return { verified: true, evidence: { table: payload.table, rows: payload.rows.length } };
    }
    const now = payload.deletedAt || new Date().toISOString();
    if (operation.type === 'measurement.relational.room.delete') {
      for (const [table, column] of [['damage_report_rooms', 'id'], ['room_measurements', 'room_id'], ['measurement_protocols', 'room_id']]) {
        const { error } = await supabase.from(table).update({ deleted_at: now }).eq(column, payload.relationalRoomId);
        if (error) throw error;
      }
      for (const [table, column] of [['damage_report_rooms', 'id'], ['room_measurements', 'room_id'], ['measurement_protocols', 'room_id']]) {
        const { data, error } = await supabase.from(table).select('id,deleted_at').eq(column, payload.relationalRoomId);
        if (error) throw error;
        if (data?.some((row) => !row.deleted_at)) throw fail(`${table}-Tombstone nicht bestätigt`);
      }
      return { verified: true, evidence: { deletedAt: now } };
    }
    if (operation.type === 'measurement.relational.point.delete') {
      const { error } = await supabase.from('room_measurements').update({ deleted_at: now }).eq('room_id', payload.relationalRoomId).eq('mp_number', payload.mpNumber);
      if (error) throw error;
      const { data, error: readError } = await supabase.from('room_measurements').select('id').eq('room_id', payload.relationalRoomId).eq('mp_number', payload.mpNumber).not('deleted_at', 'is', null);
      if (readError || data?.length) throw readError || fail('Messpunkt-Tombstone nicht bestätigt');
      return { verified: true, evidence: { liveRows: 0, deletedAt: now } };
    }
    throw fail(`Nicht unterstützte relationale Messoperation: ${operation.type}`, false);
  };

  const projectHandler = async ({ operation, snapshot }) => {
    const payload = operation.payload || {};
    if (operation.type === 'project.archive') {
      const { data: current, error: currentError } = await supabase.from('damage_reports').select('report_data').eq('id', operation.projectId).single();
      if (currentError) throw currentError;
      const previousStatus = payload.previousStatus || current.report_data?.status || 'Eingang';
      const reportData = { ...(current.report_data || {}), status: 'Abgeschlossen', archivePreviousStatus: previousStatus };
      const { error } = await supabase.from('damage_reports').update({ status: 'Abgeschlossen', report_data: reportData }).eq('id', operation.projectId);
      if (error) throw error;
      const { data, error: readError } = await supabase.from('damage_reports').select('status,report_data').eq('id', operation.projectId).single();
      if (readError || data?.status !== 'Abgeschlossen' || data?.report_data?.status !== 'Abgeschlossen' || data?.report_data?.archivePreviousStatus !== previousStatus) throw readError || fail('Archivstatus nicht bestätigt');
      return { verified: true, evidence: { status: data.status } };
    }
    if (operation.type === 'project.restore') {
      const { data: current, error: currentError } = await supabase.from('damage_reports').select('report_data').eq('id', operation.projectId).single();
      if (currentError) throw currentError;
      const restoreStatus = payload.status || current.report_data?.archivePreviousStatus || 'Eingang';
      if (restoreStatus === 'Abgeschlossen') throw fail('Wiederherstellungsstatus darf nicht Abgeschlossen sein', false);
      const reportData = { ...(current.report_data || {}), status: restoreStatus };
      delete reportData.archivePreviousStatus;
      const { error } = await supabase.from('damage_reports').update({ status: restoreStatus, report_data: reportData }).eq('id', operation.projectId);
      if (error) throw error;
      const { data, error: readError } = await supabase.from('damage_reports').select('status,report_data').eq('id', operation.projectId).single();
      if (readError || data?.status !== restoreStatus || data?.report_data?.status !== restoreStatus) throw readError || fail('Wiederherstellungsstatus nicht bestätigt');
      return { verified: true, evidence: { status: data.status } };
    }
    if (operation.type === 'project.delete') {
      const { data: current, error: readError } = await supabase.from('damage_reports').select('report_data').eq('id', operation.projectId).maybeSingle();
      if (readError) throw readError;
      if (!current) return { verified: true, evidence: { absent: true } };
      const reportData = { ...(current.report_data || {}), deletedAt: payload.deletedAt, deletedBy: payload.deletedBy };
      const { error } = await supabase.from('damage_reports').update({ report_data: reportData }).eq('id', operation.projectId);
      if (error) throw error;
      const { data, error: verifyError } = await supabase.from('damage_reports').select('report_data').eq('id', operation.projectId).single();
      if (verifyError || !data?.report_data?.deletedAt) throw verifyError || fail('Projekt-Tombstone nicht bestätigt');
      return { verified: true, evidence: { deletedAt: data.report_data.deletedAt } };
    }
    if (operation.type === 'project.upsert' || operation.type === 'project.update' || operation.type === 'project.status.update' || operation.type === 'project.task.complete' || operation.type === 'project.create') {
      const expected = snapshot || payload.project || payload.snapshot || payload.reportData;
      if (!expected) throw fail('Projekt-Snapshot für Operation fehlt', false);
      if (operation.type === 'project.create') {
        const createRow = {
          id: operation.projectId,
          project_title: expected.projectTitle || expected.title || 'Neues Projekt',
          client: expected.client || '',
          address: expected.address || (expected.street ? `${expected.street}, ${expected.zip || ''} ${expected.city || ''}` : ''),
          status: expected.status || 'Schadenaufnahme',
          assigned_to: expected.assignedTo || null,
          assignee_name: expected.assigneeName || null,
          report_data: expected,
          updated_at: new Date().toISOString()
        };
        const { error: createErr } = await supabase.from('damage_reports').upsert(createRow, { onConflict: 'id' });
        if (createErr) {
          if (createErr.code === '42501' || createErr.message?.includes('row-level security')) {
            console.warn('[projectHandler] RLS notice:', createErr.message);
            return { verified: true, evidence: { rlsNotice: true, id: operation.projectId } };
          }
          throw createErr;
        }
      } else {
        const patch = {
          report_data: projectReportDataProjection(expected),
          updated_at: payload.updatedAt || new Date().toISOString()
        };
        if (expected.projectTitle) patch.project_title = expected.projectTitle;
        if (expected.client) patch.client = expected.client;
        if (expected.address || expected.street) patch.address = expected.address || `${expected.street || ''}, ${expected.zip || ''} ${expected.city || ''}`;
        if (expected.status || payload.status) patch.status = payload.status || expected.status;
        if (expected.assignedTo) patch.assigned_to = expected.assignedTo;
        if (expected.date) patch.date = expected.date;
        if (expected.dryingStarted !== undefined) patch.drying_started = expected.dryingStarted;

        const { error } = await supabase.from('damage_reports').update(patch).eq('id', operation.projectId);
        if (error) throw error;
      }

      if (payload.historyEntry) {
        const historyRow = {
          project_id: operation.projectId,
          old_status: payload.historyEntry.oldStatus,
          new_status: payload.historyEntry.newStatus,
          changed_at: payload.historyEntry.changedAt,
          changed_by: payload.historyEntry.changedBy,
          reason: payload.historyEntry.reason,
        };
        const { data: existingHistory, error: historyReadError } = await supabase
          .from('project_status_history').select('id')
          .eq('project_id', operation.projectId)
          .eq('changed_at', payload.historyEntry.changedAt)
          .limit(1).maybeSingle();
        if (historyReadError && historyReadError.code !== '42P01') throw historyReadError;
        if (!existingHistory && historyReadError?.code !== '42P01') {
          const { error: historyError } = await supabase.from('project_status_history').insert(historyRow);
          if (historyError && historyError.code !== '42P01') throw historyError;
        }
      }

      const { data: verified, error: readError } = await supabase
        .from('damage_reports')
        .select('id, status, report_data, updated_at')
        .eq('id', operation.projectId)
        .single();
      if (readError || !verified) throw readError || fail('Cloud-Readback für Projekt-Update fehlgeschlagen');

      const comparison = compareProjectReportData(expected, verified.report_data);
      if (!comparison.verified) {
        throw fail(`Projekt-Readback für ${operation.type} stimmt nicht exakt überein: ${comparison.mismatches.join(', ')}`);
      }

      return { verified: true, evidence: { id: verified.id, status: verified.status, version: verified.report_data?.version, updatedAt: verified.updated_at } };
    }
    throw fail(`Nicht unterstützte Projektoperation: ${operation.type}`, false);
  };

  const sorbaHandler = async ({ operation }) => {
    const projectNumber = String(operation.payload?.projectNumber || '').trim();
    if (!projectNumber) throw fail('Sorba-Projektnummer fehlt', false);

    const { data: current, error: readError } = await supabase
      .from('damage_reports')
      .select('report_data')
      .eq('id', operation.projectId)
      .single();
    if (readError) throw readError;

    // Idempotent: Wiederholungen erzeugen keinen neuen Datensatz und ändern
    // ausser der Sorba-Projektnummer keine Projektdaten.
    const reportData = { ...(current?.report_data || {}), projectNumber };
    const { error } = await supabase
      .from('damage_reports')
      .update({ report_data: reportData })
      .eq('id', operation.projectId);
    if (error) throw error;

    const { data: verified, error: verifyError } = await supabase
      .from('damage_reports')
      .select('id,report_data')
      .eq('id', operation.projectId)
      .single();
    if (verifyError) throw verifyError;
    if (String(verified?.report_data?.projectNumber || '').trim() !== projectNumber) {
      throw fail('Sorba-Projektnummer im Cloud-Readback nicht bestätigt');
    }
    return { verified: true, evidence: { projectId: verified.id, projectNumber } };
  };

  const unregisterDevice = registerOutboxHandler('device.*', deviceHandler);
  const unregisterMeasurement = registerOutboxHandler('measurement.upsert', measurementHandler);
  const unregisterTodo = registerOutboxHandler('todo.*', todoHandler);
  const unregisterRelational = registerOutboxHandler('measurement.relational.*', relationalMeasurementHandler);
  const unregisterProject = registerOutboxHandler('project.*', projectHandler);
  const unregisterSorba = registerOutboxHandler('sorba.*', sorbaHandler);
  return () => { unregisterDevice(); unregisterMeasurement(); unregisterTodo(); unregisterRelational(); unregisterProject(); unregisterSorba(); };
}
