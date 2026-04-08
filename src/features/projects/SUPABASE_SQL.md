# Büro-Projektkontrolle — SQL für Supabase

## 1. `damage_reports` Tabelle erweitern

Die bestehende Tabelle wird um Felder ergänzt, die direkt abfragbar (indexiert) sind.
Die vollständigen Projektdaten bleiben in `report_data` (JSONB).

```sql
-- Neue Spalten für schnellen Zugriff ohne JSON-Parsing
ALTER TABLE damage_reports
  ADD COLUMN IF NOT EXISTS status_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_activity_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assignee_name      TEXT;

-- Backfill: Für bestehende Projekte status_started_at aus report_data lesen
UPDATE damage_reports
SET
  status_started_at = COALESCE(
    (report_data->>'statusStartedAt')::timestamptz,
    created_at
  ),
  last_activity_at  = COALESCE(
    (report_data->>'lastActivityAt')::timestamptz,
    updated_at
  ),
  assignee_name     = report_data->>'assignedTo'
WHERE status_started_at IS NULL;

-- Index für Priority-Berechnung (Status + Dauer kombiniert)
CREATE INDEX IF NOT EXISTS idx_damage_reports_status
  ON damage_reports(status);

CREATE INDEX IF NOT EXISTS idx_damage_reports_status_started
  ON damage_reports(status_started_at);

CREATE INDEX IF NOT EXISTS idx_damage_reports_assignee
  ON damage_reports(assignee_name);
```

---

## 2. `project_tasks` Tabelle (optional — für externe Task-Verwaltung)

Aktuell werden Tasks in `report_data.officeTasks[]` gespeichert.
Für volle Skalierbarkeit (spätere Filter, Zuweisung, Notifications) lohnt eine eigene Tabelle.

```sql
CREATE TABLE IF NOT EXISTS project_tasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT        NOT NULL REFERENCES damage_reports(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  done        BOOLEAN     NOT NULL DEFAULT false,
  due_date    TIMESTAMPTZ,
  category    TEXT        NOT NULL DEFAULT 'manual'  -- 'auto' | 'manual'
                          CHECK (category IN ('auto', 'manual')),
  urgent      BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id
  ON project_tasks(project_id);

CREATE INDEX IF NOT EXISTS idx_project_tasks_done
  ON project_tasks(done) WHERE done = false;

CREATE INDEX IF NOT EXISTS idx_project_tasks_urgent
  ON project_tasks(urgent) WHERE urgent = true;
```

---

## 3. `project_status_history` Tabelle

Protokolliert jeden Statuswechsel. Wird automatisch durch `updateProjectStatus()` befüllt.

```sql
CREATE TABLE IF NOT EXISTS project_status_history (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  TEXT        NOT NULL REFERENCES damage_reports(id) ON DELETE CASCADE,
  old_status  TEXT,
  new_status  TEXT        NOT NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by  TEXT,
  reason      TEXT
);

CREATE INDEX IF NOT EXISTS idx_status_history_project_id
  ON project_status_history(project_id);

CREATE INDEX IF NOT EXISTS idx_status_history_changed_at
  ON project_status_history(changed_at DESC);
```

---

## 4. Row Level Security (RLS) für neue Tabellen

```sql
-- project_tasks
ALTER TABLE project_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON project_tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- project_status_history
ALTER TABLE project_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated"
  ON project_status_history
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
```

---

## 5. Hilfreiche Abfrage: Projekte nach Priorität (für serverseitige Sortierung)

```sql
SELECT
  id,
  status,
  status_started_at,
  assignee_name,
  last_activity_at,
  EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 AS days_in_status,
  CASE
    WHEN status IN ('Schadenaufnahme') AND EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 >= 3 THEN 'red'
    WHEN status IN ('Leckortung')       AND EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 >= 5 THEN 'red'
    WHEN status IN ('Trocknung')        AND EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 >= 30 THEN 'red'
    WHEN status IN ('Schadenaufnahme') AND EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 >= 1 THEN 'yellow'
    WHEN status IN ('Leckortung')       AND EXTRACT(EPOCH FROM (now() - status_started_at)) / 86400 >= 2 THEN 'yellow'
    ELSE 'green'
  END AS priority
FROM damage_reports
WHERE status != 'Abgeschlossen'
ORDER BY
  CASE priority WHEN 'red' THEN 1 WHEN 'yellow' THEN 2 ELSE 3 END,
  days_in_status DESC;
```
