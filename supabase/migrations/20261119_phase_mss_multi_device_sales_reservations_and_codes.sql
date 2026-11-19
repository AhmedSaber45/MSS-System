-- ==============================================================================
-- STATUS: NOT EXECUTED
-- DO NOT EXECUTE DIRECTLY IN PRODUCTION WITHOUT EXPLICIT USER AUTHORIZATION
-- ==============================================================================
-- Migration: Phase — Compu MSS Multi-Device Sales, Reservations, Print & Unique Codes
-- File: supabase/migrations/20261119_phase_mss_multi_device_sales_reservations_and_codes.sql
-- Description:
--   1. Extends mss_invoices with subtotal and items_count for multi-device sales.
--   2. Creates public.mss_invoice_items table for itemized multi-device line items.
--   3. Safely backfills existing single-device invoices into mss_invoice_items without data loss.
--   4. Extends mss_reservations with items_count for multi-device reservations.
--   5. Creates public.mss_reservation_items table for itemized reservation records.
--   6. Safely backfills existing single-device reservations into mss_reservation_items.
--   7. Enforces case-insensitive uniqueness constraints and indexes on store/branch codes
--      to guarantee collision-free PREFIX-001 sequential formatting.
--   8. Establishes Row Level Security (RLS) policies, indexes, and referential constraints.
-- Target: Supabase PostgreSQL (MSS Schema)
-- Safe to execute: YES (Idempotent DDL with IF NOT EXISTS, DO blocks, and WHERE NOT EXISTS)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Update Table: mss_invoices for Multi-Device Sales
-- ==============================================================================

-- Add subtotal column if not exists
ALTER TABLE IF EXISTS public.mss_invoices 
    ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;

-- Add items_count column if not exists
ALTER TABLE IF EXISTS public.mss_invoices 
    ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 1;

-- Backfill subtotal from list_price_snapshot for existing records
UPDATE public.mss_invoices 
SET subtotal = list_price_snapshot 
WHERE subtotal IS NULL OR subtotal = 0.00;

-- Update items_count for existing single-device invoices
UPDATE public.mss_invoices 
SET items_count = 1 
WHERE items_count IS NULL OR items_count < 1;

-- Allow serial_number to be null (for non-serialized multi-device items or invoices)
ALTER TABLE IF EXISTS public.mss_invoices 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Allow device_id to be nullable in future pure multi-device schemas if necessary
ALTER TABLE IF EXISTS public.mss_invoices 
    ALTER COLUMN device_id DROP NOT NULL;

-- ==============================================================================
-- 3. Create Table: mss_invoice_items (Itemized Multi-Device Sales Line Items)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.mss_invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.mss_invoices(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    serial_number TEXT,
    is_serialized BOOLEAN NOT NULL DEFAULT true,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    list_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (list_price_snapshot >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    actual_sale_price NUMERIC(12, 2) NOT NULL CHECK (actual_sale_price >= 0),
    cost_snapshot NUMERIC(12, 2) NOT NULL CHECK (cost_snapshot >= 0),
    gross_profit NUMERIC(12, 2) NOT NULL,
    source_branch TEXT NOT NULL CHECK (source_branch IN ('محل 1', 'محل 2')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for mss_invoice_items
CREATE INDEX IF NOT EXISTS idx_mss_invoice_items_invoice ON public.mss_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoice_items_device ON public.mss_invoice_items(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoice_items_model ON public.mss_invoice_items(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoice_items_serial ON public.mss_invoice_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_invoice_items_branch ON public.mss_invoice_items(source_branch);

-- Enable Row Level Security (RLS) on mss_invoice_items
ALTER TABLE public.mss_invoice_items ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for mss_invoice_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_invoice_items' AND policyname = 'Allow authenticated users full access to mss_invoice_items'
    ) THEN
        CREATE POLICY "Allow authenticated users full access to mss_invoice_items"
            ON public.mss_invoice_items
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_invoice_items' AND policyname = 'Allow service_role full access to mss_invoice_items'
    ) THEN
        CREATE POLICY "Allow service_role full access to mss_invoice_items"
            ON public.mss_invoice_items
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_invoice_items' AND policyname = 'Allow anon select on mss_invoice_items for offline sync verification'
    ) THEN
        CREATE POLICY "Allow anon select on mss_invoice_items for offline sync verification"
            ON public.mss_invoice_items
            FOR SELECT
            TO anon
            USING (true);
    END IF;
END $$;

-- 4. Backfill existing single-device invoices into mss_invoice_items without data loss
INSERT INTO public.mss_invoice_items (
    invoice_id,
    device_id,
    model_id,
    serial_number,
    is_serialized,
    quantity,
    unit_price,
    list_price_snapshot,
    discount_amount,
    actual_sale_price,
    cost_snapshot,
    gross_profit,
    source_branch,
    created_at
)
SELECT 
    inv.id,
    inv.device_id,
    inv.model_id,
    inv.serial_number,
    (inv.serial_number IS NOT NULL AND TRIM(inv.serial_number) <> ''),
    1,
    inv.actual_sale_price,
    inv.list_price_snapshot,
    inv.discount_amount,
    inv.actual_sale_price,
    inv.cost_snapshot,
    inv.gross_profit,
    inv.source_branch,
    inv.created_at
FROM public.mss_invoices inv
WHERE inv.device_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.mss_invoice_items items WHERE items.invoice_id = inv.id
  );

-- ==============================================================================
-- 5. Update Table: mss_reservations for Multi-Device Reservations
-- ==============================================================================

-- Add items_count column if not exists
ALTER TABLE IF EXISTS public.mss_reservations 
    ADD COLUMN IF NOT EXISTS items_count INTEGER DEFAULT 1;

-- Allow serial_number to be null (for non-serialized reservations or multi-item reservations)
ALTER TABLE IF EXISTS public.mss_reservations 
    ALTER COLUMN serial_number DROP NOT NULL;

-- Allow device_id to be nullable in future multi-item reservations
ALTER TABLE IF EXISTS public.mss_reservations 
    ALTER COLUMN device_id DROP NOT NULL;

-- ==============================================================================
-- 6. Create Table: mss_reservation_items (Itemized Multi-Device Reservation Items)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.mss_reservation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.mss_reservations(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    serial_number TEXT,
    is_serialized BOOLEAN NOT NULL DEFAULT true,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
    agreed_price NUMERIC(12, 2) NOT NULL CHECK (agreed_price >= 0),
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    source_branch TEXT NOT NULL CHECK (source_branch IN ('محل 1', 'محل 2')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for mss_reservation_items
CREATE INDEX IF NOT EXISTS idx_mss_reservation_items_res ON public.mss_reservation_items(reservation_id);
CREATE INDEX IF NOT EXISTS idx_mss_reservation_items_device ON public.mss_reservation_items(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_reservation_items_model ON public.mss_reservation_items(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_reservation_items_serial ON public.mss_reservation_items(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_reservation_items_branch ON public.mss_reservation_items(source_branch);

-- Enable Row Level Security (RLS) on mss_reservation_items
ALTER TABLE public.mss_reservation_items ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies for mss_reservation_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_reservation_items' AND policyname = 'Allow authenticated users full access to mss_reservation_items'
    ) THEN
        CREATE POLICY "Allow authenticated users full access to mss_reservation_items"
            ON public.mss_reservation_items
            FOR ALL
            TO authenticated
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_reservation_items' AND policyname = 'Allow service_role full access to mss_reservation_items'
    ) THEN
        CREATE POLICY "Allow service_role full access to mss_reservation_items"
            ON public.mss_reservation_items
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'mss_reservation_items' AND policyname = 'Allow anon select on mss_reservation_items for offline sync verification'
    ) THEN
        CREATE POLICY "Allow anon select on mss_reservation_items for offline sync verification"
            ON public.mss_reservation_items
            FOR SELECT
            TO anon
            USING (true);
    END IF;
END $$;

-- 7. Backfill existing single-device reservations into mss_reservation_items without data loss
INSERT INTO public.mss_reservation_items (
    reservation_id,
    device_id,
    model_id,
    serial_number,
    is_serialized,
    quantity,
    agreed_price,
    deposit_amount,
    source_branch,
    created_at
)
SELECT 
    res.id,
    res.device_id,
    dev.model_id,
    res.serial_number,
    (res.serial_number IS NOT NULL AND TRIM(res.serial_number) <> ''),
    1,
    res.agreed_price,
    res.deposit_amount,
    res.branch,
    res.created_at
FROM public.mss_reservations res
JOIN public.mss_devices dev ON dev.id = res.device_id
WHERE res.device_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.mss_reservation_items items WHERE items.reservation_id = res.id
  );

-- ==============================================================================
-- 8. Unique Store/Branch Codes (Format: PREFIX-001)
-- ==============================================================================

-- Unique index for system_stores code (case-insensitive)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'system_stores'
    ) THEN
        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_system_stores_code_unique 
                 ON public.system_stores (UPPER(code))
                 WHERE code IS NOT NULL AND TRIM(code) <> ''''';
    END IF;
END $$;

-- ==============================================================================
-- END OF CONSOLIDATED MIGRATION
-- ==============================================================================
