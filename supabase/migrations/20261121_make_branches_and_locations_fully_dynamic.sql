-- ==============================================================================
-- COMPU MSS — DYNAMIC BRANCHES & LOCATIONS MIGRATION
-- File: supabase/migrations/20261121_make_branches_and_locations_fully_dynamic.sql
-- ==============================================================================
-- Objective:
-- 1. Remove all hardcoded check constraints restricting branches / locations
--    to ('محل 1', 'محل 2') across all MSS tables (devices, invoices, reservations,
--    returns, movements, items).
-- 2. Establish public.system_stores as the single dynamic source of truth for
--    all branches, stores, and warehouses.
-- 3. Ensure the current real locations ('محل 1' and 'محل 2') are active and configured.
-- 4. Safely soft-archive / deactivate fictional or sample locations (WH01, WH_MAIN,
--    المخزن المركزي) so they never appear in selectors or operational flows.
-- 5. Preserve 100% data integrity for all historical invoices, devices, and movements.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Drop all hardcoded location check constraints across all tables
-- ==============================================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- 2.1 Drop known named check constraints if present
    ALTER TABLE IF EXISTS public.mss_devices DROP CONSTRAINT IF EXISTS mss_devices_stock_location_check;
    ALTER TABLE IF EXISTS public.mss_device_movements DROP CONSTRAINT IF EXISTS mss_device_movements_from_location_check;
    ALTER TABLE IF EXISTS public.mss_device_movements DROP CONSTRAINT IF EXISTS mss_device_movements_to_location_check;
    ALTER TABLE IF EXISTS public.mss_invoices DROP CONSTRAINT IF EXISTS mss_invoices_selling_branch_check;
    ALTER TABLE IF EXISTS public.mss_invoices DROP CONSTRAINT IF EXISTS mss_invoices_source_branch_check;
    ALTER TABLE IF EXISTS public.mss_invoice_items DROP CONSTRAINT IF EXISTS mss_invoice_items_source_branch_check;
    ALTER TABLE IF EXISTS public.mss_reservations DROP CONSTRAINT IF EXISTS mss_reservations_branch_check;
    ALTER TABLE IF EXISTS public.mss_reservation_items DROP CONSTRAINT IF EXISTS mss_reservation_items_source_branch_check;
    ALTER TABLE IF EXISTS public.mss_returns DROP CONSTRAINT IF EXISTS mss_returns_restock_location_check;

    -- 2.2 Dynamically drop any inline / unnamed check constraints on these tables
    --     that enforce ('محل 1', 'محل 2')
    FOR r IN (
        SELECT conname, relname
        FROM pg_constraint c
        JOIN pg_class cl ON c.conrelid = cl.oid
        JOIN pg_namespace n ON cl.relnamespace = n.oid
        WHERE n.nspname = 'public'
          AND cl.relname IN (
            'mss_devices',
            'mss_device_movements',
            'mss_invoices',
            'mss_invoice_items',
            'mss_reservations',
            'mss_reservation_items',
            'mss_returns'
          )
          AND c.contype = 'c'
          AND pg_get_constraintdef(c.oid) LIKE '%محل 1%'
          AND pg_get_constraintdef(c.oid) LIKE '%محل 2%'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I;', r.relname, r.conname);
        RAISE NOTICE 'Dropped legacy check constraint % from table %', r.conname, r.relname;
    END LOOP;
END $$;

-- ==============================================================================
-- 3. Ensure Single Dynamic Source of Truth in public.system_stores
-- ==============================================================================
-- 3.1 Verify table structure
CREATE TABLE IF NOT EXISTS public.system_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'store' CHECK (type IN ('store', 'warehouse', 'combined')),
    description TEXT,
    address TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    archived_at TIMESTAMPTZ,
    merged_into_id UUID REFERENCES public.system_stores(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_system_stores_code ON public.system_stores(code);
CREATE INDEX IF NOT EXISTS idx_system_stores_name ON public.system_stores(name);
CREATE INDEX IF NOT EXISTS idx_system_stores_is_active ON public.system_stores(is_active);
CREATE INDEX IF NOT EXISTS idx_system_stores_is_archived ON public.system_stores(is_archived);

-- 3.2 Ensure 'محل 1' and 'محل 2' exist as the active stores
INSERT INTO public.system_stores (id, code, name, type, description, address, phone, is_active, is_archived)
VALUES
    (
        'e0000000-0000-0000-0000-000000000001',
        'SH01',
        'محل 1',
        'store',
        'الفرع الرئيسي - المبيعات والأجهزة',
        'القاهرة - وسط البلد',
        '01030137635',
        true,
        false
    ),
    (
        'e0000000-0000-0000-0000-000000000002',
        'SH02',
        'محل 2',
        'store',
        'الفرع الثاني - صالة العرض والمخزن',
        'الجيزة - الدقي',
        '01030137636',
        true,
        false
    )
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    is_active = true,
    is_archived = false,
    updated_at = timezone('utc', now());

-- 3.3 Soft-archive fictional or sample warehouses so they never appear in UI or active operations
UPDATE public.system_stores
SET
    is_active = false,
    is_archived = true,
    archived_at = COALESCE(archived_at, timezone('utc', now())),
    updated_at = timezone('utc', now())
WHERE
    UPPER(code) IN ('WH01', 'WH_MAIN')
    OR name IN ('المخزن المركزي', 'المخزن الرئيسي (المركزي)');

-- ==============================================================================
-- 4. Verification and Diagnostic Summary
-- ==============================================================================
DO $$
DECLARE
    v_active_stores_count INT;
    v_active_stores_names TEXT;
BEGIN
    SELECT COUNT(*), string_agg(name || ' (' || code || ')', ', ')
    INTO v_active_stores_count, v_active_stores_names
    FROM public.system_stores
    WHERE is_active = true AND is_archived = false;

    RAISE NOTICE '=======================================================';
    RAISE NOTICE 'DYNAMIC BRANCHES MIGRATION COMPLETED SUCCESSFULLY';
    RAISE NOTICE 'Active Stores Count: %', v_active_stores_count;
    RAISE NOTICE 'Active Store Names: %', v_active_stores_names;
    RAISE NOTICE 'Legacy check constraints dropped. New branches can now be added dynamically.';
    RAISE NOTICE '=======================================================';
END $$;
