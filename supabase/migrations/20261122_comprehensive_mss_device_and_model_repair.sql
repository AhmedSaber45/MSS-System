-- ==============================================================================
-- STATUS: NOT EXECUTED (PENDING MANUAL USER REVIEW)
-- ==============================================================================
-- Migration: Comprehensive MSS Device Models & Device Creation Schema Repair
-- File: supabase/migrations/20261122_comprehensive_mss_device_and_model_repair.sql
-- Module: COMPU MSS ONLY
-- Target: Supabase PostgreSQL (ylareolroigqcglayeyg)
-- Safe to Execute: YES (Idempotent DDL with IF NOT EXISTS / DROP NOT NULL)
-- Instructions: Review this script in the Supabase Dashboard SQL Editor before execution.
-- DO NOT RUN AUTOMATICALLY WITHOUT USER INITIATION.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Table: public.mss_devices (Allow Non-Serialized Devices & Bulk Inventory)
-- ------------------------------------------------------------------------------

-- A. Drop NOT NULL on serial_number so bulk devices and devices without serial numbers can be saved
ALTER TABLE IF EXISTS public.mss_devices 
    ALTER COLUMN serial_number DROP NOT NULL;

-- B. Add tracking column for serialized vs bulk stock
ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT TRUE;

-- C. Add quantity tracking for bulk stock (default 1 for individual units)
ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- D. Positive quantity check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_mss_devices_quantity_positive'
    ) THEN
        ALTER TABLE public.mss_devices 
            ADD CONSTRAINT chk_mss_devices_quantity_positive CHECK (quantity >= 1);
    END IF;
END $$;

-- E. Drop original unconditional unique constraint on serial_number if present
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mss_devices_serial_number_key'
    ) THEN
        ALTER TABLE public.mss_devices DROP CONSTRAINT mss_devices_serial_number_key;
    END IF;
END $$;

-- F. Partial Unique Index: enforce uniqueness ONLY when serial_number is not null and non-empty
CREATE UNIQUE INDEX IF NOT EXISTS idx_mss_devices_serial_unique 
    ON public.mss_devices (UPPER(serial_number)) 
    WHERE serial_number IS NOT NULL AND TRIM(serial_number) <> '';

-- G. Query performance indexes
CREATE INDEX IF NOT EXISTS idx_mss_devices_model_id 
    ON public.mss_devices (model_id);

CREATE INDEX IF NOT EXISTS idx_mss_devices_stock_location 
    ON public.mss_devices (stock_location);

CREATE INDEX IF NOT EXISTS idx_mss_devices_status 
    ON public.mss_devices (status);

CREATE INDEX IF NOT EXISTS idx_mss_devices_is_serialized 
    ON public.mss_devices (is_serialized);

-- ------------------------------------------------------------------------------
-- 2. Supporting Tables: Allow Non-Serialized References
-- ------------------------------------------------------------------------------

-- Table: public.mss_device_movements
ALTER TABLE IF EXISTS public.mss_device_movements 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Table: public.mss_invoices
ALTER TABLE IF EXISTS public.mss_invoices 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Table: public.mss_reservations
ALTER TABLE IF EXISTS public.mss_reservations 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Table: public.mss_returns
ALTER TABLE IF EXISTS public.mss_returns 
    ALTER COLUMN serial_number DROP NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. Table: public.mss_sync_log (Expand allowed operation types)
-- ------------------------------------------------------------------------------

DO $$
BEGIN
    -- Drop old operation_type check constraint if it restricts modern operation types
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_mss_sync_log_op_type'
    ) THEN
        ALTER TABLE public.mss_sync_log DROP CONSTRAINT chk_mss_sync_log_op_type;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. Manual Review: Cleanup of Test Runner Models (COMMENTED OUT BY DEFAULT)
-- ------------------------------------------------------------------------------
-- Note: During earlier test runner runs (e.g. npm test with un-mocked Supabase client),
-- 45 test model records were inserted directly into mss_models with timestamped names.
-- The user's legitimate model is:
--   ID: '565f8770-f616-4413-9baf-4088b5435f24'
--   Brand: 'HP'
--   Model Name: 'HP Z Book G7'
--
-- If the administrator wishes to clean up the test runner records, the following
-- query can be reviewed and executed manually. It strictly excludes the real model:
--
-- DELETE FROM public.mss_models
-- WHERE id <> '565f8770-f616-4413-9baf-4088b5435f24'
--   AND (
--     model_name LIKE 'mwru%' 
--     OR model_name LIKE '%QA-%'
--     OR model_name LIKE 'Test%'
--     OR model_name LIKE 'ThinkPad QA%'
--     OR model_name LIKE 'Latitude QA%'
--     OR model_name LIKE 'UltraSharp QA%'
--   );
-- ------------------------------------------------------------------------------

-- ==============================================================================
-- End of Migration: Comprehensive MSS Device Models & Device Creation Schema Repair
-- STATUS: NOT EXECUTED (PENDING MANUAL USER REVIEW)
-- ==============================================================================
