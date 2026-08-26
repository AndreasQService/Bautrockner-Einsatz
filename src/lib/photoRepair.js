const REPAIRABLE_SUPABASE_REASONS = new Set(['MISSING_SUPABASE_PATH', 'MISSING_SUPABASE_OBJECT']);

export async function scheduleSupabasePhotoRepairs({ results = [], scheduled, updateStatus, sync }) {
  const candidates = results.filter(result => !result.verified && result.id && REPAIRABLE_SUPABASE_REASONS.has(result.reason));
  for (const result of candidates) {
    if (scheduled.has(result.id)) continue;
    scheduled.add(result.id);
    try {
      await updateStatus(result.id, {
        syncStatus: 'error', terminalFailure: false, needsUserAction: false,
        errorMessage: `Supabase-Reparatur: ${result.reason}`
      });
      await sync();
      scheduled.delete(result.id);
    } catch (error) {
      scheduled.delete(result.id);
      throw error;
    }
  }
  return candidates.map(candidate => candidate.id);
}
