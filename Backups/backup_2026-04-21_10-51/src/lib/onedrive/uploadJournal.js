/**
 * uploadJournal.js
 * Optionales serverseitiges Journal in Supabase
 *
 * Zweck: Kontrollinstanz, NICHT Blob-Speicher.
 * Jede Datei bekommt vor Upload einen Datensatz.
 * Nach erfolgreichem OneDrive-Upload wird er auf 'verified' gesetzt.
 *
 * Tabelle: project_image_uploads
 *   id             uuid PK
 *   local_image_id text (= UploadItem.id)
 *   project_id     text
 *   sha256         text
 *   status         text
 *   remote_path    text
 *   remote_item_id text
 *   created_at     timestamptz
 *   updated_at     timestamptz
 *
 * SQL für Supabase:
 *   CREATE TABLE IF NOT EXISTS project_image_uploads (
 *     id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 *     local_image_id text NOT NULL,
 *     project_id     text NOT NULL,
 *     sha256         text,
 *     status         text NOT NULL DEFAULT 'pending',
 *     remote_path    text,
 *     remote_item_id text,
 *     created_at     timestamptz NOT NULL DEFAULT now(),
 *     updated_at     timestamptz NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX ON project_image_uploads (project_id);
 *   CREATE INDEX ON project_image_uploads (local_image_id);
 */

import { supabase } from '../../supabaseClient.js';

/**
 * Registriert eine neue Datei im Supabase-Journal (vor Upload)
 * @param {import('../uploads/queueTypes').UploadItem} item
 */
export async function journalRegister(item) {
  const { error } = await supabase
    .from('project_image_uploads')
    .upsert({
      local_image_id: item.id,
      project_id:     item.projectId,
      sha256:         item.sha256,
      status:         'pending',
      remote_path:    item.remotePath,
      updated_at:     new Date().toISOString(),
    }, {
      onConflict: 'local_image_id',
    });

  if (error) {
    // Journal-Fehler ist nicht kritisch – Upload wird trotzdem gestartet
    console.warn('[Journal] Registrierung fehlgeschlagen:', error.message);
  }
}

/**
 * Markiert eine Datei im Supabase-Journal als verifiziert (nach OneDrive-Bestätigung)
 * @param {string} localImageId  UploadItem.id
 * @param {string} remoteItemId  OneDrive Item ID
 */
export async function journalVerify(localImageId, remoteItemId) {
  const { error } = await supabase
    .from('project_image_uploads')
    .update({
      status:         'verified',
      remote_item_id: remoteItemId,
      updated_at:     new Date().toISOString(),
    })
    .eq('local_image_id', localImageId);

  if (error) {
    console.warn('[Journal] Verifikation fehlgeschlagen:', error.message);
  }
}

/**
 * Alle ausstehenden Journal-Einträge eines Projekts (für Übersicht / Audit)
 * @param {string} projectId
 */
export async function journalGetPending(projectId) {
  const { data, error } = await supabase
    .from('project_image_uploads')
    .select('*')
    .eq('project_id', projectId)
    .neq('status', 'verified');

  if (error) {
    console.warn('[Journal] Abfrage fehlgeschlagen:', error.message);
    return [];
  }
  return data ?? [];
}
