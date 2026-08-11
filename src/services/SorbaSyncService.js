/**
 * SorbaSyncService.js
 * Direkter Datentransfer QTool ↔ Sorba via Microsoft Power Automate (Ohne Excel)
 */
import { supabase } from '../supabaseClient';

/**
 * 1. QTool ➔ Sorba: Bestimmte Projektdaten an Power Automate HTTP Webhook senden
 */
export async function sendProjectToSorba(projectData, webhookUrl = null) {
  if (!projectData) return { success: false, error: 'Keine Projektdaten vorhanden' };

  const payload = {
    qtoolProjectId: projectData.id,
    projectTitle: projectData.projectTitle || projectData.project_title || '',
    client: projectData.client || '',
    street: projectData.street || '',
    zip: projectData.zip || '',
    city: projectData.city || '',
    address: projectData.address || `${projectData.street || ''}, ${projectData.zip || ''} ${projectData.city || ''}`,
    damageType: projectData.damageType || projectData.type || '',
    status: projectData.status || 'Schadenaufnahme',
    assignedTo: projectData.assignedTo || '',
    dryingStarted: projectData.dryingStarted || null,
    createdDate: projectData.date || new Date().toISOString()
  };

  const targetWebhook = webhookUrl || (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SORBA_POWER_AUTOMATE_WEBHOOK_URL);

  if (targetWebhook) {
    try {
      const response = await fetch(targetWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        return { success: true, message: 'Erfolgreich an Sorba übermittelt' };
      }
    } catch (e) {
      console.warn('[SorbaSync] Webhook-Übertragung fehlgeschlagen:', e);
    }
  }

  console.log('[SorbaSync] Projekt-Payload für Sorba bereitgestellt:', payload);
  return { success: true, payload };
}

/**
 * 2. Sorba ➔ QTool: Sorba-Projektnummer direkt in Supabase aktualisieren (Ohne Excel)
 */
export async function updateSorbaProjectNumber(qtoolProjectId, sorbaProjectNumber) {
  if (!qtoolProjectId || !sorbaProjectNumber) return { success: false, error: 'Fehlende Parameter' };

  if (!supabase) return { success: false, error: 'Supabase Client nicht verfügbar' };

  try {
    const { data: current, error: readErr } = await supabase
      .from('damage_reports')
      .select('report_data')
      .eq('id', qtoolProjectId)
      .single();

    if (readErr) throw readErr;

    const updatedReportData = {
      ...(current?.report_data || {}),
      projectNumber: String(sorbaProjectNumber).trim()
    };

    const { data, error } = await supabase
      .from('damage_reports')
      .update({
        report_data: updatedReportData,
        updated_at: new Date().toISOString()
      })
      .eq('id', qtoolProjectId)
      .select();

    if (error) throw error;

    return { success: true, data };
  } catch (e) {
    console.error('[SorbaSync] Fehler beim Aktualisieren der Sorba-Projektnummer:', e);
    return { success: false, error: e.message };
  }
}
