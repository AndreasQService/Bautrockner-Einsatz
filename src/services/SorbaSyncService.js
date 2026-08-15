/**
 * SorbaSyncService.js
 * Direkter Datentransfer QTool ↔ Sorba via Microsoft Power Automate (Ohne Excel)
 */
import { registerDomainMutation } from '../lib/offline/domainMutationAdapter.js';

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

  try {
    const projectNumber = String(sorbaProjectNumber).trim();
    const manifest = await registerDomainMutation({
      projectId: String(qtoolProjectId),
      type: 'sorba.project_number.update',
      entityId: String(qtoolProjectId),
      payload: { projectNumber },
      snapshot: {
        projectId: String(qtoolProjectId),
        pendingSorbaProjectNumber: projectNumber,
      },
    });

    // success bedeutet hier ausschliesslich: dauerhaft lokal gesichert.
    // Erst der Outbox-Handler darf nach Cloud-Readback cloud_confirmed setzen.
    return {
      success: true,
      localConfirmed: true,
      cloudConfirmed: false,
      transactionId: manifest.transactionId,
      projectNumber,
    };
  } catch (e) {
    console.error('[SorbaSync] Sorba-Projektnummer konnte nicht lokal gesichert werden:', e);
    return { success: false, error: e.message };
  }
}
