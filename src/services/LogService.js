import { supabase } from '../supabaseClient';

/**
 * LogService.js
 * Zentrales Logging für Upload-Fehler (Rule 12)
 */
export const LogService = {
  /**
   * Protokolliert einen Fehler beim Datei-Upload in Supabase
   */
  async logUploadError(fileId, projectId, error, context = {}) {
    console.error(`[LogService] Upload-Fehler für ${fileId}:`, error);
    
    if (!supabase) return;

    try {
      const { error: dbError } = await supabase
        .from('upload_errors')
        .insert({
          file_id: fileId,
          project_id: projectId,
          error_message: error.message || String(error),
          context: context,
          created_at: new Date().toISOString()
        });
      
      if (dbError) {
        console.warn('[LogService] Konnte Fehler nicht in DB schreiben:', dbError.message);
      }
    } catch (e) {
      console.warn('[LogService] Logging-Fehler:', e.message);
    }
  },

  /**
   * Protokolliert allgemeine System-Fehler
   */
  async logError(message, context = {}) {
    console.error(`[LogService] Fehler: ${message}`, context);
    // Hier könnten weitere Ziele wie Sentry etc. angebunden werden
  }
};
