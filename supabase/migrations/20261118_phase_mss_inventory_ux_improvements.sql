-- ==============================================================================
-- STATUS: NOT EXECUTED
-- ==============================================================================
-- Migration: Phase — Compu MSS Inventory & UX Improvements
-- File: supabase/migrations/20261118_phase_mss_inventory_ux_improvements.sql
-- Description: Supports optional device serial numbers, bulk non-serialized stock
--              quantities, conversion of bulk stock to serialized units, automated
--              store code uniqueness, and updates commerce & movement constraints.
-- Target: Supabase PostgreSQL (MSS Schema)
-- Safe to execute: YES (Idempotent DDL with IF NOT EXISTS / DROP NOT NULL)
-- DO NOT DEPLOY / DO NOT EXECUTE DIRECTLY IN PRODUCTION WITHOUT AUTHORIZATION
-- ==============================================================================

-- 1. Table: mss_devices
-- Drop NOT NULL constraint on serial_number to allow non-serialized stock
ALTER TABLE IF EXISTS public.mss_devices 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Add tracking columns for bulk non-serialized inventory
ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT TRUE;

ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

-- Add check constraint to ensure quantity is at least 1
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_mss_devices_quantity_positive'
    ) THEN
        ALTER TABLE public.mss_devices 
            ADD CONSTRAINT chk_mss_devices_quantity_positive CHECK (quantity >= 1);
    END IF;
END $$;

-- Drop original unconditional unique constraint on serial_number if it exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mss_devices_serial_number_key'
    ) THEN
        ALTER TABLE public.mss_devices DROP CONSTRAINT mss_devices_serial_number_key;
    END IF;
END $$;

-- Create partial unique index on non-null serial numbers to ensure uniqueness only when a serial is present
CREATE UNIQUE INDEX IF NOT EXISTS idx_mss_devices_serial_unique 
    ON public.mss_devices (UPPER(serial_number)) 
    WHERE serial_number IS NOT NULL AND TRIM(serial_number) <> '';

-- Index for querying serialized vs bulk stock
CREATE INDEX IF NOT EXISTS idx_mss_devices_is_serialized 
    ON public.mss_devices (is_serialized);

-- 2. Table: mss_device_movements
-- Allow logging physical transfers of non-serialized bulk devices
ALTER TABLE IF EXISTS public.mss_device_movements 
    ALTER COLUMN serial_number DROP NOT NULL;

-- 3. Table: mss_invoices
-- Allow creating sales invoices for non-serialized devices
ALTER TABLE IF EXISTS public.mss_invoices 
    ALTER COLUMN serial_number DROP NOT NULL;

-- 4. Table: mss_reservations
-- Allow reservations for non-serialized stock units
ALTER TABLE IF EXISTS public.mss_reservations 
    ALTER COLUMN serial_number DROP NOT NULL;

-- 5. Table: mss_returns
-- Allow returns for invoices of non-serialized devices
ALTER TABLE IF EXISTS public.mss_returns 
    ALTER COLUMN serial_number DROP NOT NULL;

-- 6. Table: mss_stores
-- Ensure unique store code index for automatically generated branch/warehouse codes
CREATE UNIQUE INDEX IF NOT EXISTS idx_mss_stores_code_unique 
    ON public.mss_stores (UPPER(code));

-- ==============================================================================
-- End of Migration: Phase — Compu MSS Inventory & UX Improvements
-- STATUS: NOT EXECUTED
-- ==============================================================================
