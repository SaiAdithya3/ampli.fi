-- Add action column to distinguish swap vs borrow
ALTER TABLE bridge_orders ADD COLUMN IF NOT EXISTS action TEXT NOT NULL DEFAULT 'swap';

-- Drop UNIQUE constraint on atomiq_swap_id (frontend reports it later, may retry)
ALTER TABLE bridge_orders DROP CONSTRAINT IF EXISTS bridge_orders_atomiq_swap_id_key;

-- Drop atomiq_swaps table (no longer needed - SDK moved to frontend)
DROP TABLE IF EXISTS atomiq_swaps;
DROP INDEX IF EXISTS idx_atomiq_swaps_storage_key;

-- Drop bridge_actions and bridge_events (backend no longer orchestrates swaps)
DROP TABLE IF EXISTS bridge_actions;
DROP TABLE IF EXISTS bridge_events;

-- Drop unused legacy columns from bridge_orders
ALTER TABLE bridge_orders DROP COLUMN IF EXISTS quote_json;
ALTER TABLE bridge_orders DROP COLUMN IF EXISTS expires_at;
ALTER TABLE bridge_orders DROP COLUMN IF EXISTS raw_state_json;
