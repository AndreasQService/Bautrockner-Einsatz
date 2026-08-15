const requireRows = (result, label) => {
  if (result?.error) throw new Error(`${label} konnten nicht vollständig geladen werden: ${result.error.message}`);
  return Array.isArray(result?.data) ? result.data : [];
};

/** Loads every cloud-backed project entity before the offline session is admitted. */
export async function materializeProjectForOffline(supabase, project) {
  if (!supabase?.from || !project?.id) throw new TypeError('Supabase und Projekt-ID sind erforderlich');
  const projectId = String(project.id);
  const [
    roomsResult, measurementsResult, protocolsResult, todosResult, devicesResult,
    docsResult, uploadsResult, statusHistoryResult, tasksResult, rentalDevicesResult,
    extractionsResult,
  ] = await Promise.all([
    supabase.from('damage_report_rooms').select('*').eq('report_id', projectId).is('deleted_at', null),
    supabase.from('room_measurements').select('*').eq('report_id', projectId).is('deleted_at', null),
    supabase.from('measurement_protocols').select('*').eq('report_id', projectId).is('deleted_at', null),
    supabase.from('project_todos').select('*').eq('project_id', projectId),
    supabase.from('devices').select('*').eq('current_report_id', projectId),
    supabase.from('case_documents').select('*').eq('case_id', projectId),
    supabase.from('project_image_uploads').select('*').eq('project_id', projectId),
    // These sources are deliberately authoritative for an admitted offline
    // session. A missing table/policy/query is not equivalent to an empty list:
    // requireRows below fails closed instead of silently losing cloud data.
    supabase.from('project_status_history').select('*').eq('project_id', projectId),
    supabase.from('project_tasks').select('*').eq('project_id', projectId),
    supabase.from('rental_devices').select('*').eq('report_id', projectId),
    supabase.from('case_extractions').select('*').eq('case_id', projectId),
  ]);
  const relationalRooms = requireRows(roomsResult, 'Räume');
  const relationalMeasurements = requireRows(measurementsResult, 'Messwerte');
  const relationalProtocols = requireRows(protocolsResult, 'Messprotokolle');
  const todos = requireRows(todosResult, 'To-dos');
  const devices = requireRows(devicesResult, 'Geräte');
  const documents = requireRows(docsResult, 'Dokumente');
  const uploadJournal = requireRows(uploadsResult, 'Upload-Journal');
  const statusHistory = requireRows(statusHistoryResult, 'Statushistorie');
  const projectTasks = requireRows(tasksResult, 'Projektaufgaben');
  const rentalDevices = requireRows(rentalDevicesResult, 'Mietgeräte');
  const caseExtractions = requireRows(extractionsResult, 'Dokumentextraktionen');
  const artifacts = [
    ...documents.map(row => ({ entityId: row.id, kind: 'case_document', bucket: row.bucket || 'case-files', source: row.storage_path || row.file_path || row.file_url || row.public_url || row.url })),
    ...relationalProtocols.map(row => ({
      entityId: row.id || row.legacy_protocol_id, kind: 'measurement_protocol', bucket: row.bucket || 'case-files',
      source: row.storage_path || row.file_url || row.public_url || row.url,
    })),
    ...uploadJournal.map(row => ({
      entityId: row.local_image_id || row.id, kind: 'image', bucket: row.storage_bucket || 'case-files',
      source: row.storage_path || row.public_url || row.signed_url || row.url,
    })),
  ];
  const missingArtifact = artifacts.find(item => !item.source);
  if (missingArtifact) throw new Error(`${missingArtifact.kind} besitzt weder Storage-Pfad noch Download-URL`);
  const storageArtifacts = artifacts.map(item => /^https?:/i.test(item.source)
    ? { ...item, url: item.source }
    : { ...item, path: item.source });
  return {
    ...project,
    projectTodos: todos,
    devices,
    caseDocuments: documents,
    projectStatusHistory: statusHistory,
    projectTasks,
    rentalDevices,
    caseExtractions,
    _offlineMaterialization: {
      projectId, relationalRooms, relationalMeasurements, relationalProtocols,
      todos, devices, documents, uploadJournal, statusHistory, projectTasks,
      rentalDevices, caseExtractions, storageArtifacts,
      authoritativeSources: [
        'damage_report_rooms', 'room_measurements', 'measurement_protocols',
        'project_todos', 'devices', 'case_documents', 'project_image_uploads',
        'project_status_history', 'project_tasks', 'rental_devices', 'case_extractions',
      ],
    },
  };
}
