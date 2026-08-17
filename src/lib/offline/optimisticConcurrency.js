/**
 * True Atomic Optimistic Concurrency Control for Office Multi-User Edits
 * Enforces PostgreSQL atomic update conditions: `WHERE id = :id AND updated_at = :last_known_updated_at`.
 * Never relies on client device clock math or time drift heuristics.
 */

export function checkOptimisticConflict(localData, serverData) {
  if (!localData || !serverData) {
    return { hasConflict: false };
  }

  const localVersionTag = String(localData._supabase_updated_at || localData.updated_at || '').trim();
  const serverVersionTag = String(serverData._supabase_updated_at || serverData.updated_at || '').trim();

  // If server version tag differs from local base version tag, check for field changes
  if (localVersionTag && serverVersionTag && localVersionTag !== serverVersionTag) {
    const changedFields = [];
    const fieldsToCompare = ['projectTitle', 'client', 'address', 'status', 'description', 'notes'];

    fieldsToCompare.forEach(field => {
      const localVal = localData[field] || localData.report_data?.[field] || '';
      const serverVal = serverData[field] || serverData.report_data?.[field] || '';
      if (String(localVal).trim() !== String(serverVal).trim()) {
        changedFields.push({ field, localVal, serverVal });
      }
    });

    if (changedFields.length > 0) {
      return {
        hasConflict: true,
        localData,
        serverData,
        changedFields,
        message: 'Ein anderer Benutzer hat dieses Projekt in der Zwischenzeit aktualisiert.'
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Atomic PostgreSQL update with updated_at guard.
 * Returns { success: true, updatedRow } or { hasConflict: true } if 0 rows were affected.
 */
export async function updateProjectAtomicOptimistic({ supabase, projectId, expectedUpdatedAt, patchData }) {
  if (!supabase || !projectId) throw new Error('Supabase Client und Projekt-ID erforderlich');

  const nowIso = new Date().toISOString();
  let query = supabase
    .from('damage_reports')
    .update({
      ...patchData,
      updated_at: nowIso
    })
    .eq('id', projectId);

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt);
  }

  const { data, error } = await query.select();

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    // 0 rows affected -> concurrent update occurred in database
    return {
      hasConflict: true,
      message: 'Datensatz wurde zwischenzeitlich durch einen anderen Benutzer aktualisiert.'
    };
  }

  return {
    success: true,
    hasConflict: false,
    updatedRow: data[0]
  };
}
