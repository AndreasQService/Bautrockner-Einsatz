# TEST SCHEMA AUDIT: QTool Datenbank-Konsolidierung

Dieses Dokument dokumentiert die Detailanalyse aller im QTool-Repository vorhandenen SQL-Dateien und die getroffenen Konsolidierungsentscheidungen für die Testumgebung.

---

## 1. Tabellen-Audit im Detail

### 1. `damage_reports` (Kernaustauschtabelle)
* **Quelle(n):** `schema.sql`, `supabase_security_upgrade.sql`, `src/features/projects/SUPABASE_SQL.md`
* **Spalten:** `id` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `project_title` (TEXT), `client` (TEXT), `address` (TEXT), `status` (TEXT), `assigned_to` (TEXT), `date` (DATE), `drying_started` (TIMESTAMPTZ), `status_started_at` (TIMESTAMPTZ), `assignee_name` (TEXT), `deleted_at` (TIMESTAMPTZ), `deleted_by` (TEXT), `report_data` (JSONB), `image_urls` (JSONB).
* **Primärschlüssel:** `id` (TEXT, z.B. `"P-2026-02-1001"`)
* **Foreign Keys:** Keine (Elterntabelle).
* **Trigger:** `tr_damage_reports_updated_at` (`fn_set_updated_at()`).
* **RLS aktiv:** Ja.
* **Policies:**
  * Authenticated: Full Access (`SELECT`, `INSERT`, `UPDATE`, `DELETE`).
  * Anon: Controlled Dev Access (`SELECT`, `INSERT`, `UPDATE`).
* **Konflikte & Konsolidierung:**
  * *Konflikt:* `schema.sql` hatte keine `deleted_at` und `status_started_at` Spalten.
  * *Entscheidung:* Alle Spalten aus `supabase_security_upgrade.sql` und `SUPABASE_SQL.md` wurden in das Init-Schema aufgenommen.

---

### 2. `devices` (Trocknungsgeräte-Inventar)
* **Quelle(n):** `schema.sql`, `devices_schema.sql`
* **Spalten:** `id` (UUID), `created_at` (TIMESTAMPTZ), `number` (TEXT), `type` (TEXT), `model` (TEXT), `status` (TEXT), `current_project` (TEXT), `current_report_id` (TEXT), `energy_consumption` (NUMERIC).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `current_report_id REFERENCES damage_reports(id) ON DELETE SET NULL`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.
* **Konflikte & Konsolidierung:**
  * *Konflikt:* In `schema.sql` war `current_report_id` kein echter Foreign Key.
  * *Entscheidung:* Echtes FK-Constraint auf `damage_reports(id)` hinzugefügt.

---

### 3. `device_catalog` (Gerätekatalog)
* **Quelle(n):** `supabase/migrations/device_catalog_setup.sql`
* **Spalten:** `id` (UUID), `model_name` (TEXT UNIQUE), `device_type` (TEXT), `manufacturer` (TEXT), `power_watts` (INT), `kwh_per_day` (NUMERIC), `notes` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** Keine.
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 4. `rental_devices` (Mietgeräte)
* **Quelle(n):** `supabase/migrations/20260720000000_rental_devices.sql`
* **Spalten:** `id` (UUID), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `report_id` (TEXT), `device_type` (TEXT), `device_number` (TEXT), `start_date` (DATE), `end_date` (DATE), `notes` (TEXT).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `report_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 5. `project_image_uploads` (Upload-Queue Journal)
* **Quelle(n):** `supabase/migrations/create_project_image_uploads.sql`
* **Spalten:** `id` (UUID), `project_id` (TEXT), `created_by` (UUID), `created_by_name` (TEXT), `local_image_id` (TEXT UNIQUE), `filename` (TEXT), `mime_type` (TEXT), `size_bytes` (BIGINT), `sha256` (TEXT), `storage_bucket` (TEXT), `storage_path` (TEXT), `remote_path` (TEXT), `remote_item_id` (TEXT), `remote_etag` (TEXT), `upload_session_url` (TEXT), `bytes_uploaded` (BIGINT), `storage_status` (TEXT), `retry_count` (INT), `last_error` (TEXT), `last_attempt_at` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ), `verified_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `project_id REFERENCES damage_reports(id) ON DELETE CASCADE`, `created_by REFERENCES auth.users(id) ON DELETE SET NULL`.
* **Trigger:** `set_piu_updated_at`.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 6. `project_sessions` (Aktive Tabellen-Sperren)
* **Quelle(n):** `supabase_project_sessions.sql`
* **Spalten:** `session_token` (TEXT), `open_project_id` (TEXT), `mode` (TEXT), `device` (TEXT), `last_seen` (TIMESTAMPTZ), `created_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `session_token` (TEXT)
* **Foreign Keys:** `open_project_id REFERENCES damage_reports(id) ON DELETE SET NULL`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 7. `project_tasks` (Workflow-Aufgaben)
* **Quelle(n):** `src/features/projects/SUPABASE_SQL.md`
* **Spalten:** `id` (UUID), `project_id` (TEXT), `title` (TEXT), `is_completed` (BOOLEAN), `due_date` (TIMESTAMPTZ), `assignee_name` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `project_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 8. `project_status_history` (Status-Verlauf)
* **Quelle(n):** `src/features/projects/SUPABASE_SQL.md`
* **Spalten:** `id` (UUID), `project_id` (TEXT), `from_status` (TEXT), `to_status` (TEXT), `changed_by` (TEXT), `changed_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `project_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 9. `case_documents` (Dateiupload-Tracking)
* **Quelle(n):** `supabase_migrations.sql`
* **Spalten:** `id` (UUID), `case_id` (TEXT), `file_path` (TEXT), `file_type` (TEXT), `original_filename` (TEXT), `extraction_status` (TEXT), `created_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `case_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 10. `case_extractions` (KI-Extraktionsdaten)
* **Quelle(n):** `supabase_migrations.sql`
* **Spalten:** `id` (UUID), `case_id` (TEXT), `json_result` (JSONB), `confidence` (JSONB), `evidence` (JSONB), `created_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `case_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 11. `damage_report_rooms` (Messungs-Räume)
* **Quelle(n):** `supabase/migrations/20260514000000_measurements_arch.sql`
* **Spalten:** `id` (UUID), `report_id` (TEXT), `room_name` (TEXT), `apartment` (TEXT), `length_m` (NUMERIC), `width_m` (NUMERIC), `height_m` (NUMERIC), `area_sqm` (NUMERIC), `volume_cum` (NUMERIC), `canvas_image_url` (TEXT), `created_at` (TIMESTAMPTZ), `updated_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `report_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 12. `room_measurements` (Einzelmessungen)
* **Quelle(n):** `supabase/migrations/20260514000000_measurements_arch.sql`
* **Spalten:** `id` (UUID), `room_id` (UUID), `measurement_type` (TEXT), `value_digit` (NUMERIC), `unit` (TEXT), `position_x` (NUMERIC), `position_y` (NUMERIC), `notes` (TEXT), `measured_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `room_id REFERENCES damage_report_rooms(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 13. `measurement_protocols` (Messprotokoll-PDFs)
* **Quelle(n):** `supabase/migrations/20260514000000_measurements_arch.sql`
* **Spalten:** `id` (UUID), `report_id` (TEXT), `protocol_number` (TEXT), `pdf_storage_path` (TEXT), `created_by` (TEXT), `created_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** `report_id REFERENCES damage_reports(id) ON DELETE CASCADE`
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 14. `damage_reports_audit` & `audit_log` (System-Audits)
* **Quelle(n):** `supabase_security_upgrade.sql`, `supabase/migrations/20260514000000_measurements_arch.sql`
* **Spalten:** `id` (UUID), `report_id` (TEXT), `changed_at` (TIMESTAMPTZ), `changed_by` (TEXT), `action` (TEXT), `old_status` (TEXT), `new_status` (TEXT), `old_data` (JSONB), `new_data` (JSONB).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** Keine.
* **Trigger:** Trigger auf `damage_reports`.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

### 15. `qtool_operations` (Operations-Log)
* **Quelle(n):** `supabase/migrations/20260514000000_measurements_arch.sql`
* **Spalten:** `id` (UUID), `operation_name` (TEXT), `status` (TEXT), `details` (JSONB), `created_at` (TIMESTAMPTZ).
* **Primärschlüssel:** `id` (UUID)
* **Foreign Keys:** Keine.
* **Trigger:** Keine.
* **RLS aktiv:** Ja.
* **Policies:** Authenticated Full Access, Anon Dev Access.

---

## 2. Storage Bucket Audit (`case-files`)
* **Bucket-Name:** `case-files` (Public = True, File Size Limit = 50 MB)
* **Allowed Mime Types:** `image/jpeg`, `image/png`, `image/heic`, `image/webp`, `application/pdf`
* **Storage RLS Policies:** `SELECT`, `INSERT`, `UPDATE`, `DELETE` für `authenticated` und `anon`.
