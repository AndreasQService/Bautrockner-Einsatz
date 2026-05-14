-- SAFE ADDITIVE MIGRATION
-- Does not delete or modify damage_reports.report_data
-- report_id is TEXT because existing QTool IDs include UUID-like IDs, P-* IDs, numeric project IDs and TMP-* IDs
-- Legacy JSON remains source of truth until application read/write logic is migrated
-- This migration must be reviewed before execution

-- ========================================================================================
-- QTool Migration: Relational Architecture for Rooms and Measurements
-- ========================================================================================

CREATE OR REPLACE FUNCTION public.safe_cast_numeric(p_val text)
RETURNS numeric AS $$
BEGIN
  IF p_val IS NULL OR btrim(p_val) = '' THEN
    RETURN NULL;
  END IF;

  RETURN replace(btrim(p_val), ',', '.')::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.safe_cast_integer(p_val text)
RETURNS integer AS $$
BEGIN
  IF p_val IS NULL OR btrim(p_val) = '' THEN
    RETURN NULL;
  END IF;

  RETURN btrim(p_val)::integer;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.safe_cast_timestamptz(p_val text)
RETURNS timestamptz AS $$
BEGIN
  IF p_val IS NULL OR btrim(p_val) = '' THEN
    RETURN NULL;
  END IF;

  RETURN btrim(p_val)::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Table: damage_report_rooms
CREATE TABLE IF NOT EXISTS public.damage_report_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL, -- NO strict FK to damage_reports(id) yet to avoid type/constraint mismatch
    legacy_room_id TEXT,
    name TEXT,
    room_type TEXT,
    sort_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    version INTEGER DEFAULT 1
);

-- Unique index for idempotent room migration
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_report_legacy_unique
ON public.damage_report_rooms(report_id, legacy_room_id)
WHERE legacy_room_id IS NOT NULL;

-- 2. Table: room_measurements
CREATE TABLE IF NOT EXISTS public.room_measurements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,
    room_id UUID NOT NULL REFERENCES public.damage_report_rooms(id) ON DELETE CASCADE,
    legacy_measurement_id TEXT,
    source TEXT, -- 'measurementData' or 'measurementHistory'
    mp_number INTEGER,
    wall_value NUMERIC,
    floor_value NUMERIC,
    device TEXT,
    measured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    version INTEGER DEFAULT 1
);

-- Unique index for idempotent measurement migration
CREATE UNIQUE INDEX IF NOT EXISTS idx_measurements_legacy_unique
ON public.room_measurements(report_id, room_id, legacy_measurement_id)
WHERE legacy_measurement_id IS NOT NULL;

-- 3. Table: measurement_protocols
CREATE TABLE IF NOT EXISTS public.measurement_protocols (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT NOT NULL,
    room_id UUID NOT NULL REFERENCES public.damage_report_rooms(id) ON DELETE CASCADE,
    legacy_protocol_id TEXT,
    source TEXT,
    protocol_type TEXT,
    file_url TEXT,
    storage_path TEXT,
    checksum_sha256 TEXT,
    canvas_data JSONB,
    upload_status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ,
    created_by TEXT,
    updated_by TEXT,
    version INTEGER DEFAULT 1
);

-- Unique index for idempotent protocol migration
CREATE UNIQUE INDEX IF NOT EXISTS idx_protocols_legacy_unique
ON public.measurement_protocols(report_id, room_id, legacy_protocol_id)
WHERE legacy_protocol_id IS NOT NULL;

-- 4. Table: audit_log
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL, -- TEXT for compatibility with legacy IDs
    action TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    user_id TEXT,
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Prevent update/delete on audit_log
REVOKE UPDATE, DELETE ON public.audit_log FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_audit_update ON public.audit_log;
CREATE TRIGGER trg_prevent_audit_update
BEFORE UPDATE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

DROP TRIGGER IF EXISTS trg_prevent_audit_delete ON public.audit_log;
CREATE TRIGGER trg_prevent_audit_delete
BEFORE DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

-- 5. Table: qtool_operations
CREATE TABLE IF NOT EXISTS public.qtool_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_operation_id TEXT UNIQUE NOT NULL,
    report_id TEXT,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB,
    user_id TEXT,
    device_id TEXT,
    status TEXT DEFAULT 'pending',
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    synced_at TIMESTAMPTZ
);

-- ========================================================================================
-- Indexes for Performance
-- ========================================================================================
-- Rooms
CREATE INDEX IF NOT EXISTS idx_rooms_report_id ON public.damage_report_rooms(report_id);
CREATE INDEX IF NOT EXISTS idx_rooms_deleted_at ON public.damage_report_rooms(deleted_at);
CREATE INDEX IF NOT EXISTS idx_rooms_updated_at ON public.damage_report_rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_rooms_report_deleted ON public.damage_report_rooms(report_id, deleted_at);

-- Measurements
CREATE INDEX IF NOT EXISTS idx_measurements_report_id ON public.room_measurements(report_id);
CREATE INDEX IF NOT EXISTS idx_measurements_room_id ON public.room_measurements(room_id);
CREATE INDEX IF NOT EXISTS idx_measurements_deleted_at ON public.room_measurements(deleted_at);
CREATE INDEX IF NOT EXISTS idx_measurements_measured_at ON public.room_measurements(measured_at);
CREATE INDEX IF NOT EXISTS idx_measurements_report_room ON public.room_measurements(report_id, room_id);

-- Protocols
CREATE INDEX IF NOT EXISTS idx_protocols_report_id ON public.measurement_protocols(report_id);
CREATE INDEX IF NOT EXISTS idx_protocols_room_id ON public.measurement_protocols(room_id);
CREATE INDEX IF NOT EXISTS idx_protocols_status ON public.measurement_protocols(upload_status);
CREATE INDEX IF NOT EXISTS idx_protocols_deleted_at ON public.measurement_protocols(deleted_at);

-- Operations
CREATE INDEX IF NOT EXISTS idx_operations_client_id ON public.qtool_operations(client_operation_id);
CREATE INDEX IF NOT EXISTS idx_operations_report_id ON public.qtool_operations(report_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON public.qtool_operations(status);
CREATE INDEX IF NOT EXISTS idx_operations_created_at ON public.qtool_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_operations_synced_at ON public.qtool_operations(synced_at);

-- Audit Log
CREATE INDEX IF NOT EXISTS idx_audit_report_id ON public.audit_log(report_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.audit_log(created_at);

-- ========================================================================================
-- Trigger: Auto-update updated_at and version
-- ========================================================================================
CREATE OR REPLACE FUNCTION update_timestamp_and_version()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    IF TG_OP = 'UPDATE' THEN
        NEW.version = OLD.version + 1;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_rooms_update ON public.damage_report_rooms;
CREATE TRIGGER trg_rooms_update BEFORE UPDATE ON public.damage_report_rooms FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_version();

DROP TRIGGER IF EXISTS trg_measurements_update ON public.room_measurements;
CREATE TRIGGER trg_measurements_update BEFORE UPDATE ON public.room_measurements FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_version();

DROP TRIGGER IF EXISTS trg_protocols_update ON public.measurement_protocols;
CREATE TRIGGER trg_protocols_update BEFORE UPDATE ON public.measurement_protocols FOR EACH ROW EXECUTE FUNCTION update_timestamp_and_version();

-- ========================================================================================
-- Migration Function (Phase 1): Extract JSON rooms idempotently
-- ========================================================================================
CREATE OR REPLACE FUNCTION migrate_legacy_rooms_to_relational()
RETURNS void AS $$
DECLARE
    report_record RECORD;
    room_elem JSONB;
    room_idx INTEGER;
    hist_elem JSONB;
    hist_idx INTEGER;
    meas_elem JSONB;
    meas_idx INTEGER;
    current_legacy_room_id TEXT;
    resolved_room_id UUID;
    
    current_legacy_measurement_id TEXT;
    current_legacy_protocol_id TEXT;
BEGIN
    FOR report_record IN SELECT id::TEXT as string_id, report_data FROM public.damage_reports WHERE report_data ? 'rooms' LOOP
        
        room_idx := 0;
        FOR room_elem IN SELECT * FROM jsonb_array_elements(report_record.report_data->'rooms') LOOP
            
            -- Deterministic Legacy Room ID
            IF room_elem ? 'id' AND room_elem->>'id' IS NOT NULL AND room_elem->>'id' != '' THEN
                current_legacy_room_id := room_elem->>'id';
            ELSE
                current_legacy_room_id := 'idx-' || room_idx;
            END IF;

            -- Insert Room Idempotently
            INSERT INTO public.damage_report_rooms (
                report_id, legacy_room_id, name, room_type, sort_order, created_by
            )
            VALUES (
                report_record.string_id, current_legacy_room_id, room_elem->>'name', room_elem->>'apartment', room_idx, 'system_migration'
            )
            ON CONFLICT (report_id, legacy_room_id) WHERE legacy_room_id IS NOT NULL 
            DO UPDATE SET 
                name = EXCLUDED.name,
                room_type = EXCLUDED.room_type,
                sort_order = EXCLUDED.sort_order
            RETURNING id INTO resolved_room_id;

            -- Insert MeasurementData (current active measurements)
            IF room_elem ? 'measurementData' AND room_elem->'measurementData' ? 'measurements' THEN
                meas_idx := 0;
                FOR meas_elem IN SELECT * FROM jsonb_array_elements(room_elem->'measurementData'->'measurements') LOOP
                    current_legacy_measurement_id := md5(report_record.string_id || ':' || current_legacy_room_id || ':md:' || meas_idx);
                    
                    INSERT INTO public.room_measurements (
                        report_id, room_id, legacy_measurement_id, source, mp_number, wall_value, floor_value, device, measured_at, created_by
                    ) VALUES (
                        report_record.string_id, resolved_room_id, current_legacy_measurement_id, 'measurementData',
                        public.safe_cast_integer(meas_elem->>'mp'),
                        public.safe_cast_numeric(meas_elem->>'w'),
                        public.safe_cast_numeric(meas_elem->>'b'),
                        meas_elem->>'device',
                        public.safe_cast_timestamptz(room_elem->'measurementData'->'globalSettings'->>'date'),
                        'system_migration'
                    )
                    ON CONFLICT (report_id, room_id, legacy_measurement_id) WHERE legacy_measurement_id IS NOT NULL DO NOTHING;
                    meas_idx := meas_idx + 1;
                END LOOP;
                
                -- Protocol from MeasurementData
                IF room_elem->'measurementData' ? 'protocolUrl' AND (room_elem->'measurementData'->>'protocolUrl') IS NOT NULL THEN
                    current_legacy_protocol_id := md5(report_record.string_id || ':' || current_legacy_room_id || ':md_protocol');
                    INSERT INTO public.measurement_protocols (
                        report_id, room_id, legacy_protocol_id, source, protocol_type, file_url, upload_status, created_by
                    ) VALUES (
                        report_record.string_id, resolved_room_id, current_legacy_protocol_id, 'measurementData', 'pdf_protocol',
                        room_elem->'measurementData'->>'protocolUrl', 'completed', 'system_migration'
                    )
                    ON CONFLICT (report_id, room_id, legacy_protocol_id) WHERE legacy_protocol_id IS NOT NULL DO NOTHING;
                END IF;
            END IF;

            -- Insert MeasurementHistory
            IF room_elem ? 'measurementHistory' THEN
                hist_idx := 0;
                FOR hist_elem IN SELECT * FROM jsonb_array_elements(room_elem->'measurementHistory') LOOP
                    
                    -- Insert History Measurements
                    IF hist_elem ? 'measurements' THEN
                        meas_idx := 0;
                        FOR meas_elem IN SELECT * FROM jsonb_array_elements(hist_elem->'measurements') LOOP
                            current_legacy_measurement_id := md5(report_record.string_id || ':' || current_legacy_room_id || ':hist:' || hist_idx || ':m:' || meas_idx);
                            
                            INSERT INTO public.room_measurements (
                                report_id, room_id, legacy_measurement_id, source, mp_number, wall_value, floor_value, device, measured_at, created_by
                            ) VALUES (
                                report_record.string_id, resolved_room_id, current_legacy_measurement_id, 'measurementHistory',
                                public.safe_cast_integer(meas_elem->>'mp'),
                                public.safe_cast_numeric(meas_elem->>'w'),
                                public.safe_cast_numeric(meas_elem->>'b'),
                                meas_elem->>'device',
                                public.safe_cast_timestamptz(hist_elem->>'date'),
                                'system_migration'
                            )
                            ON CONFLICT (report_id, room_id, legacy_measurement_id) WHERE legacy_measurement_id IS NOT NULL DO NOTHING;
                            meas_idx := meas_idx + 1;
                        END LOOP;
                    END IF;

                    -- Insert History Protocol
                    IF hist_elem ? 'protocolUrl' AND (hist_elem->>'protocolUrl') IS NOT NULL THEN
                        current_legacy_protocol_id := md5(report_record.string_id || ':' || current_legacy_room_id || ':hist_protocol:' || hist_idx);
                        INSERT INTO public.measurement_protocols (
                            report_id, room_id, legacy_protocol_id, source, protocol_type, file_url, upload_status, created_by
                        ) VALUES (
                            report_record.string_id, resolved_room_id, current_legacy_protocol_id, 'measurementHistory', 'pdf_protocol',
                            hist_elem->>'protocolUrl', 'completed', 'system_migration'
                        )
                        ON CONFLICT (report_id, room_id, legacy_protocol_id) WHERE legacy_protocol_id IS NOT NULL DO NOTHING;
                    END IF;

                    hist_idx := hist_idx + 1;
                END LOOP;
            END IF;

            room_idx := room_idx + 1;
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
