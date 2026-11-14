-- ==============================================================================
-- Migration: Phase 07 — MSS Individual Inventory & Serial Tracking & Transfers
-- File: supabase/migrations/20261114_phase07_mss_inventory_serials.sql
-- Description: Establishes individual physical unit tracking by unique serial number,
--              status constraints, physical shop transfers, and movement history.
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Safe to execute: YES (Idempotent with IF NOT EXISTS)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Table: mss_devices (Verify constraints and indexes if not created by Phase 06)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT NOT NULL UNIQUE,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_cost >= 0),
    list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (list_price >= 0),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    physical_condition TEXT NOT NULL DEFAULT 'فرز أول',
    stock_location TEXT NOT NULL CHECK (stock_location IN ('محل 1', 'محل 2')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'MAINTENANCE', 'RETURNED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Ensure indexes exist for high-speed serial scanner lookups and location tracking
CREATE INDEX IF NOT EXISTS idx_mss_devices_serial ON public.mss_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_devices_model ON public.mss_devices(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_devices_location ON public.mss_devices(stock_location);
CREATE INDEX IF NOT EXISTS idx_mss_devices_status ON public.mss_devices(status);
CREATE INDEX IF NOT EXISTS idx_mss_devices_created_at ON public.mss_devices(created_at DESC);

-- ==============================================================================
-- 3. Table: mss_device_movements (Explicit Physical Transfers Between Shops)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_device_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    from_location TEXT NOT NULL CHECK (from_location IN ('محل 1', 'محل 2')),
    to_location TEXT NOT NULL CHECK (to_location IN ('محل 1', 'محل 2')),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    movement_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (movement_status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_mss_movement_locations_different CHECK (from_location <> to_location)
);

-- Indexes for movement history lookups
CREATE INDEX IF NOT EXISTS idx_mss_movements_device ON public.mss_device_movements(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_movements_serial ON public.mss_device_movements(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_movements_date ON public.mss_device_movements(movement_date DESC);
CREATE INDEX IF NOT EXISTS idx_mss_movements_locations ON public.mss_device_movements(from_location, to_location);

-- ==============================================================================
-- 4. Row Level Security (RLS) Configuration for Movements (Rule 11)
-- ==============================================================================
ALTER TABLE public.mss_device_movements ENABLE ROW LEVEL SECURITY;

-- Allow read access to movement records for both shops
DROP POLICY IF EXISTS "Allow public read access to mss_device_movements" ON public.mss_device_movements;
CREATE POLICY "Allow public read access to mss_device_movements"
    ON public.mss_device_movements
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow inserting movement records with location and serial validation
DROP POLICY IF EXISTS "Allow clients insert to mss_device_movements" ON public.mss_device_movements;
CREATE POLICY "Allow clients insert to mss_device_movements"
    ON public.mss_device_movements
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(trim(serial_number)) > 0 AND
        from_location IN ('محل 1', 'محل 2') AND
        to_location IN ('محل 1', 'محل 2') AND
        from_location <> to_location
    );

-- Allow updating movement status (e.g. IN_TRANSIT to COMPLETED)
DROP POLICY IF EXISTS "Allow clients update to mss_device_movements" ON public.mss_device_movements;
CREATE POLICY "Allow clients update to mss_device_movements"
    ON public.mss_device_movements
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (
        from_location IN ('محل 1', 'محل 2') AND
        to_location IN ('محل 1', 'محل 2') AND
        from_location <> to_location
    );

-- ==============================================================================
-- 5. Stored Function: transfer_mss_device
-- Atomically moves a device between shops and logs the explicit movement record
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.transfer_mss_device(
    p_device_id UUID,
    p_to_location TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_current_location TEXT;
    v_serial_number TEXT;
    v_movement_id UUID;
BEGIN
    -- 1. Validate destination location
    IF p_to_location NOT IN ('محل 1', 'محل 2') THEN
        RAISE EXCEPTION 'الموقع المطلوب غير صالح. يجب أن يكون "محل 1" أو "محل 2"';
    END IF;

    -- 2. Find device and lock row
    SELECT stock_location, serial_number
    INTO v_current_location, v_serial_number
    FROM public.mss_devices
    WHERE id = p_device_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الجهاز غير موجود بالمعرف المحدد';
    END IF;

    -- 3. Prevent transferring to the same location
    IF v_current_location = p_to_location THEN
        RAISE EXCEPTION 'الجهاز متواجد بالفعل في % ولا يمكن نقله لنفس الموقع', p_to_location;
    END IF;

    -- 4. Update the device stock location
    UPDATE public.mss_devices
    SET stock_location = p_to_location,
        updated_at = timezone('utc', now())
    WHERE id = p_device_id;

    -- 5. Insert the movement record
    INSERT INTO public.mss_device_movements (
        device_id,
        serial_number,
        from_location,
        to_location,
        movement_date,
        movement_status,
        notes
    ) VALUES (
        p_device_id,
        v_serial_number,
        v_current_location,
        p_to_location,
        timezone('utc', now()),
        'COMPLETED',
        p_notes
    ) RETURNING id INTO v_movement_id;

    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to anon and authenticated
GRANT EXECUTE ON FUNCTION public.transfer_mss_device(UUID, TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- 6. Seed Sample Movements
-- ==============================================================================
INSERT INTO public.mss_device_movements (id, device_id, serial_number, from_location, to_location, movement_date, movement_status, notes)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'b0000000-0000-0000-0000-000000000004',
        '8F9X022-DELL',
        'محل 2',
        'محل 1',
        timezone('utc', now() - INTERVAL '2 days'),
        'COMPLETED',
        'نقل للعرض في واجهة محل 1 بناء على طلب الإدارة'
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'b0000000-0000-0000-0000-000000000006',
        'CN49129-MON',
        'محل 2',
        'محل 1',
        timezone('utc', now() - INTERVAL '1 day'),
        'COMPLETED',
        'نقل شاشة احترافية لتجهيز طلب تجميعة عميل بمحل 1'
    )
ON CONFLICT (id) DO NOTHING;
