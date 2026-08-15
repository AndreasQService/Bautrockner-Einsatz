/**
 * RETIRED: the legacy global queue worker wrote to the production QTool root
 * without the project-owner/final-sync contract. This fail-closed endpoint
 * also prevents old schedules from silently processing stale data.
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(() => new Response(JSON.stringify({
  error: 'LEGACY_ONEDRIVE_SYNC_RETIRED',
  message: 'Use the lock-aware durable upload worker.',
}), {
  status: 410,
  headers: { 'Content-Type': 'application/json' },
}));
