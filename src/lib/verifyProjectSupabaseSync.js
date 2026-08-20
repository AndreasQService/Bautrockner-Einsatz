import { getProjectPhotoCandidates, itemKey, reportCategoryMatches } from './projectSyncSummary.js';

export const storagePathFor = item => {
  let value = String(item?.supabasePath || item?.storagePath || item?.url || '').trim();
  if (!value) return null;
  const marker = '/object/public/case-files/';
  if (value.includes(marker)) value = value.split(marker)[1];
  else if (/^https?:\/\//i.test(value)) return null;
  return decodeURIComponent(value).replace(/^\/+/, '');
};

const verifyStorageObject = async (supabase, path) => {
  const slash = path.lastIndexOf('/');
  const folder = slash >= 0 ? path.slice(0, slash) : '';
  const fileName = slash >= 0 ? path.slice(slash + 1) : path;
  if (!fileName) return false;
  const { data, error } = await supabase.storage.from('case-files').list(folder, { search: fileName, limit: 100 });
  if (error) throw error;
  return Array.isArray(data) && data.some(entry => entry?.name === fileName && entry?.id);
};

const verifyDevices = async (supabase, reportId, devices) => {
  const verified = [];
  for (let index = 0; index < devices.length; index += 1) {
    const device = devices[index];
    const key = itemKey(device, index);
    if (device?.isRental) {
      if (!device.rentalDbId) continue;
      const { data, error } = await supabase.from('rental_devices').select('id, report_id, end_date')
        .eq('id', device.rentalDbId).eq('report_id', reportId).maybeSingle();
      if (error) throw error;
      if (data?.id && data.end_date == null) verified.push(key);
    } else {
      if (!device?.dbId) continue;
      const { data, error } = await supabase.from('devices').select('id, current_report_id')
        .eq('id', device.dbId).eq('current_report_id', reportId).maybeSingle();
      if (error) throw error;
      if (data?.id) verified.push(key);
    }
  }
  return verified;
};

export async function verifyProjectSupabaseSync({ supabase, report }) {
  if (!supabase || !report?.id) throw new Error('Projekt oder Supabase-Verbindung fehlt.');
  const reportId = String(report.id);
  const { data: remoteRow, error: reportError } = await supabase.from('damage_reports')
    .select('id, report_data').eq('id', reportId).single();
  if (reportError || String(remoteRow?.id) !== reportId || !remoteRow?.report_data) {
    throw reportError || new Error('Projekt-Readback wurde nicht bestätigt.');
  }

  const matches = reportCategoryMatches(report, remoteRow.report_data);
  const photos = getProjectPhotoCandidates(report);
  const verifiedPhotoKeys = [];
  for (let index = 0; index < photos.length; index += 1) {
    const path = storagePathFor(photos[index]);
    if (path && await verifyStorageObject(supabase, path)) verifiedPhotoKeys.push(itemKey(photos[index], index));
  }

  const devices = Array.isArray(report?.equipment) ? report.equipment : (Array.isArray(report?.devices) ? report.devices : []);
  return {
    verifiedPhotoKeys,
    verifiedDeviceKeys: matches.devices ? await verifyDevices(supabase, reportId, devices) : [],
    textVerified: matches.text,
    protocolsVerified: matches.protocols,
    verifiedAt: new Date().toISOString()
  };
}
