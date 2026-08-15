# Offline-First Write Coverage (QTool-Test)

> SUPERVISOR GATE (strict session/abschluss contract): **IMPLEMENTED LOCALLY,
> RUNTIME/TEST-BACKEND PROOF STILL REQUIRED**.
> The table below is the earlier local-first inventory, not proof that runtime
> writes obey the newer rule "no business cloud write before explicit finish".
> Direct/legacy paths listed below are blockers until removed, deferred into the
> final-sync coordinator, or proven read-only.

## Strict-session traceability (2026-08-13)

| Requirement | Implementation/evidence | Gate |
|---|---|---|
| Atomic single-owner lock on online open | `useSessionLock.js`, test migration/RPC contract | Pending runtime + server-policy proof |
| Every other user/device/session read-only | UI lock plus server enforcement required for every mutation/RPC | **Blocked:** no proof all tables/RPCs enforce owner token |
| Complete project locally available with verified counts | session worker in progress | Pending |
| No cloud business write during edit session | final-sync barrier required | **Blocked:** active App autosave, legacy image sync/backfill, todo/device/status paths still contain direct writes |
| Explicit finish syncs DB/relational/Storage/OneDrive | final-sync worker in progress | Pending |
| Supabase/OneDrive readback, hashes and counts | media handler has byte readbacks; global project evidence incomplete | Pending |
| Exit blocked for offline/pending/failed/conflict | strict exit policy in progress | Pending runtime proof |
| Release lock only after fully_confirmed + owner token | coordinator/session workers in progress | Pending |
| Crash/TTL recovery separate from normal release | lock migration contract | Pending runtime proof |
| No offline-library/cache cleanup policy | `pruneConfirmedOfflineData` defaults disabled | Pass (static) |

### Runtime blockers found by Supervisor inventory

- `App.jsx`: direct project update/upsert autosaves and boot legacy image worker.
- `DamageForm.jsx`: active legacy photo sync/backfill; direct Storage/OneDrive
  writes for images, exterior images and measurement protocols; direct
  Energieprotokoll/Excel exports need mandatory-vs-optional classification.
- `TodoService.js`, `DeviceManager.jsx`, `statusActions.js`: compatibility direct
  business writes still need final-sync barrier/server lock enforcement.
- `supabaseDomainHandlers.js`: centralized handlers still execute whenever the
  generic outbox worker runs; strict sessions require them to remain locally
  queued until explicit finish.
- All server mutations/RPCs must require project id + owner session token. UI
  read-only state alone is not enforcement.
- Current test schema policies explicitly allow every authenticated user to
  insert/update `damage_reports`, devices, relational measurement tables and
  `case-files` Storage (`auth.uid() IS NOT NULL`). Therefore the existing lock
  RPC/unique index does **not** make other users read-only at the server.

### Runtime closure added 2026-08-14

The production entry graph (`main.jsx` -> `App.jsx`) imports the active write
surfaces `DamageForm.jsx`, `Dashboard.jsx`, `DeviceManager.jsx`,
`TodoService.js`, `statusActions.js`, `UploadPanel.jsx`,
`MeasurementRelationalService.js`, `supabaseDomainHandlers.js`,
`supabaseMediaHandlers.js`, the legacy `PhotoStorage` worker and
`OneDriveService.js`. Timestamped `DamageForm_*` files and `useDamageForm.js`
have no runtime importer and remain excluded.

All Supabase REST, RPC, Edge Function and Storage requests from those runtime modules now pass
the central transport gate in `supabaseClient.js` / `sessionCloudWriteGate.js`:

- GET/read traffic remains available to locked readers.
- `acquire_project_lock` and `release_project_lock` remain technical exceptions.
- every other REST/RPC/Storage mutation is rejected while a durable project
  session exists;
- Edge Function POSTs (including `delete-project` and downstream workers) are
  rejected by the same transport gate; they were a previously unguarded bypass;
- the explicit exit coordinator opens the gate only with `projectId` and the
  owner's session token;
- guarded fetch injects fresh `x-qtool-session-token` and
  `x-qtool-project-id` headers without mutating caller-owned headers;
- the context is closed in `finally`, including failed exits;
- OneDrive's `graphFetch` and direct folder-creation fetch apply the same
  active-session/explicit-finish rule;
- the independent `ProjectImageUploadPanel -> useUploadQueue -> uploadWorker`
  path is also closed: app-start/online/add-files runs return `skipped` while a
  session is active, final drain is project-scoped, and `oneDriveApi.js` gates
  folder creation, upload-session creation, manifest writes and every
  self-authenticated upload-chunk PUT;
- strict exit now drains and reconciles `qtool-upload-db` explicitly and blocks
  on `uploaded_unverified`, pending, uploading, failed or needs-repair items;
  the central outbox being empty alone can no longer hide this second queue;
- `runCloudAfterLocal` no longer runs its legacy media fast-path during an
  active session; the durable operation remains queued for final sync.

This client closure is defense in depth, not the server proof. Test RLS/RPC and
Storage policies still must validate both injected headers against the single
owner lock and the target project. New-project creation must use the atomic
`create_project_and_acquire_lock` RPC before the project form can open.

Static inventory: 2026-08-13. `DamageForm_*` timestamped backup files are not runtime imports and are excluded.

| Area / write path | Files | Classification | Contract / remaining action |
|---|---|---|---|
| Project create/update | `src/App.jsx` | Central | `project.upsert`; durable snapshot before network; DB readback (`id`, `updated_at`, version) before confirmation. |
| Project delete | `src/App.jsx` | Central | `project.delete` tombstone; delete is idempotent; readback must prove project absent/soft-deleted. |
| Damage/mail/exterior/edited images | `DamageForm.jsx`, `ImageEditor.jsx`, `supabaseMediaHandlers.js` | Central | Blob + association first; deterministic Storage path; download size/hash and project association readback. |
| Measurement protocol files | `DamageForm.jsx`, `supabaseMediaHandlers.js` | Central | Same media contract plus room/measurement association. |
| Measurements without file | `DamageForm.jsx`, `MeasurementRelationalService.js` | Central | Legacy snapshot plus relational room/measurement/protocol upserts are durable and read back field-by-field. |
| Device assignment/inventory/checkout | `DamageForm.jsx` | Central | `device.*`; device row plus assignment/status is read back before confirmation. |
| Device administration | `DeviceManager.jsx` | Central compatibility path | Device/catalog insert/update/delete/import registers durably before the existing online fast path; handler is idempotent and verifies affected fields/absence. |
| To-do user actions | `TodoService.js` | Central | `todo.*`; row state and compound RPC effects are read back. |
| Automatic to-dos/fallback migrations | `TodoService.js` | Central compatibility path | Auto/follow-up/local migration creates register durable deterministic operations before direct compatibility writes. |
| Project status actions/history | `features/projects/statusActions.js` | Central compatibility path | Status/project snapshot plus history entry is one durable operation; project readback is mandatory. |
| Dashboard archive/restore actions | `components/Dashboard.jsx`, `supabaseDomainHandlers.js` | Central | Archive/restore registers locally first; previous status is preserved, both top-level and report-data status are read back, and the archive marker is removed on restore. |
| Drying manager | `components/DamageForm/sections/DryingManager.jsx`, `supabaseDomainHandlers.js` | Central | Device assign/checkout/undo registers device plus full project-equipment snapshot; both device row and `damage_reports.report_data.equipment` must match readback before confirmation. |
| Upload panel | `components/UploadPanel.jsx` | Central | Temporary project IDs are local-only; image/document blobs enter IndexedDB first. Storage, `case_documents`, readback and extraction run in the central media handler. |
| Legacy photo sync worker | `PhotoStorage.js`, `lib/sync/supabaseSyncWorker.js` | Fail-closed migration boundary | Normal runtime calls now return `legacy_migration_not_explicit`. Existing rows and blobs remain durable, but the legacy read/modify/write path cannot upload, link stale image metadata or mark rows synced. A separately authorized migration must opt in explicitly and reconcile into the central transaction model. |
| OneDrive durable upload queue/journal | `lib/uploads/*`, `lib/onedrive/uploadJournal.js` | Technical internal | Separate downstream queue; it may run only after QTool cloud association is confirmed. |
| Session locks | `hooks/useSessionLock.js` | Technical ephemeral | RPC/delete represents a lease, not business data; intentionally not offline replayed. |
| Logs | `services/LogService.js` | Technical best-effort | Telemetry/audit insert; must never block or represent business save confirmation. |
| Sorba project number | `services/SorbaSyncService.js`, `supabaseDomainHandlers.js` | Central | `sorba.project_number.update` is durably registered first, is idempotent by project, and is cloud-confirmed only after the exact project number is read back. Webhook acceptance itself is not treated as Sorba readback. |
| Old `ProjectSyncService` | `services/ProjectSyncService.js` | Dormant technical legacy | No runtime import found. Its separate IndexedDB queue is not a central cloud-confirmation source and must not be reactivated without migration. |
| Other local stores | `DeviceLocalStore.js` | Technical compatibility | Local recovery only; must not be interpreted as central cloud confirmation. |
| Hook image upload | `hooks/useDamageForm.js` | Inactive legacy | Static runtime import scan finds no importer under `src` (only its own export). Active `DamageForm.jsx` owns runtime form logic; this hook is excluded until deliberately reintroduced. |

## Handler verification rule

No handler may return `{ verified: true }` merely because a mutation request succeeded. It must read the affected cloud state back and prove the expected business outcome. Deletes prove absence (or the agreed soft-delete marker); compound operations prove every affected row; media proves both stored bytes and project association.
