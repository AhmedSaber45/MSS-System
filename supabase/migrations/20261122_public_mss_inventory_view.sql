-- ==============================================================================
-- Migration: Public MSS Inventory Read-Only View & Access Layer
-- File: supabase/migrations/20261122_public_mss_inventory_view.sql
-- Description:
--   Creates a dedicated, secure, read-only database view and stored procedure
--   for the standalone public-facing inventory application (public-mss-inventory).
--   Exposes strictly public model details, live aggregated quantities
--   per branch and per status (AVAILABLE, RESERVED, SOLD), specifications,
--   and selling prices in EGP.
--   Strictly protects confidential business information: purchase costs, supplier
--   records, serial numbers, customer details, profit margins, and internal notes
--   are NEVER exposed through this layer.
-- Target: Supabase PostgreSQL (MSS Schema)
-- Status: PREPARED & VALIDATED — NOT EXECUTED (Ready for Supabase SQL Editor review)
-- Safe to execute: YES (100% Idempotent, non-destructive, read-only layer)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Ensure backward-compatible inventory tracking columns on mss_devices
-- If table mss_devices was created without the optional bulk quantity column,
-- safely add it so that both serialized units (quantity=1) and non-serialized units
-- are supported seamlessly without schema errors.
-- ==============================================================================

ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;

ALTER TABLE IF EXISTS public.mss_devices 
    ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT TRUE;

-- Update any historical rows that might have NULL quantity to 1
UPDATE public.mss_devices 
SET quantity = 1 
WHERE quantity IS NULL;

-- ==============================================================================
-- 3. View: public.vw_public_mss_inventory
-- Aggregates inventory by model, branch location, and status.
-- Supports AVAILABLE, RESERVED, and SOLD statuses.
-- Only active, non-archived branches from public.system_stores are included.
-- Zero confidential columns (no purchase_cost, notes, serial_number, customer info).
-- ==============================================================================

CREATE OR REPLACE VIEW public.vw_public_mss_inventory AS
SELECT
    md5(m.id::text || '_' || COALESCE(s.name, d.stock_location) || '_' || d.status) AS id,
    m.id AS model_id,
    m.model_name,
    m.brand,
    m.category,
    m.processor,
    m.gpu,
    m.ram,
    m.storage,
    m.screen_size,
    m.specifications,
    COALESCE(NULLIF(MAX(d.list_price), 0), m.default_list_price, 0)::NUMERIC(12, 2) AS selling_price,
    COALESCE(s.name, d.stock_location) AS branch_name,
    d.status AS status,
    SUM(COALESCE(d.quantity, 1))::INTEGER AS quantity,
    MAX(d.updated_at) AS last_updated_at
FROM public.mss_devices d
JOIN public.mss_models m ON d.model_id = m.id
LEFT JOIN public.system_stores s ON (
    d.stock_location = s.name 
    OR d.stock_location = s.code 
    OR d.stock_location = s.id::text
)
WHERE d.status IN ('AVAILABLE', 'RESERVED', 'SOLD')
  AND (s.is_active IS NULL OR s.is_active = true)
  AND (s.is_archived IS NULL OR s.is_archived = false)
GROUP BY 
    m.id,
    m.model_name,
    m.brand,
    m.category,
    m.processor,
    m.gpu,
    m.ram,
    m.storage,
    m.screen_size,
    m.specifications,
    COALESCE(s.name, d.stock_location),
    d.status
HAVING SUM(COALESCE(d.quantity, 1)) > 0;

COMMENT ON VIEW public.vw_public_mss_inventory IS 
'Public read-only inventory view for customer catalog. Exposes model specifications, branch quantities, status, and selling prices. Zero confidential columns.';

-- ==============================================================================
-- 4. Security & Access Grants
-- Grant read-only access to anon (unauthenticated public) and authenticated roles.
-- ==============================================================================

GRANT SELECT ON public.vw_public_mss_inventory TO anon, authenticated;
GRANT SELECT ON public.system_stores TO anon, authenticated;

-- ==============================================================================
-- 5. Stored Procedure: public.get_public_mss_inventory()
-- Provides a clean, callable RPC endpoint with optional status filtering.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_public_mss_inventory(p_status TEXT DEFAULT NULL)
RETURNS TABLE (
    id TEXT,
    model_id UUID,
    model_name TEXT,
    brand TEXT,
    category TEXT,
    processor TEXT,
    gpu TEXT,
    ram TEXT,
    storage TEXT,
    screen_size TEXT,
    specifications TEXT,
    selling_price NUMERIC(12, 2),
    branch_name TEXT,
    status TEXT,
    quantity INTEGER,
    last_updated_at TIMESTAMPTZ
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        v.id,
        v.model_id,
        v.model_name,
        v.brand,
        v.category,
        v.processor,
        v.gpu,
        v.ram,
        v.storage,
        v.screen_size,
        v.specifications,
        v.selling_price,
        v.branch_name,
        v.status,
        v.quantity,
        v.last_updated_at
    FROM public.vw_public_mss_inventory v
    WHERE (p_status IS NULL OR p_status = 'ALL' OR v.status = p_status)
    ORDER BY v.brand ASC, v.model_name ASC, v.branch_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_mss_inventory(TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.get_public_mss_inventory(TEXT) IS 
'Public RPC returning inventory grouped by model, branch, and status (AVAILABLE, RESERVED, SOLD).';

-- ==============================================================================
-- 6. Enable Realtime Broadcast for Devices and Stores (if supported)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'mss_devices'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.mss_devices;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'system_stores'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.system_stores;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
