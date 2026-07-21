-- Migration to support rental devices (Mietgeräte) in inventory
ALTER TABLE devices 
ADD COLUMN IF NOT EXISTS is_rental BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS rental_provider TEXT,
ADD COLUMN IF NOT EXISTS rental_start DATE,
ADD COLUMN IF NOT EXISTS rental_end_planned DATE,
ADD COLUMN IF NOT EXISTS rental_cost_daily NUMERIC DEFAULT 0;

-- Optional index for faster query filtering
CREATE INDEX IF NOT EXISTS idx_devices_is_rental ON devices(is_rental);
