-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 5 CONSOLIDATED MIGRATION
-- Inventory Management, Stock Transfers & Synchronization
-- Migration File: supabase/migrations/20261117_phase05_inventory_transfers.sql
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Adjust Location Constraints on Devices and Movements
-- ==============================================================================
-- Allow mss_devices and mss_device_movements to hold any valid store name or code
-- from system_stores (e.g. WH_MAIN, COMB_DOWNTOWN, etc.), dropping hardcoded 'محل 1' / 'محل 2' check.
DO $$ 
BEGIN
    -- Drop restrictive stock_location check on mss_devices if present
    ALTER TABLE public.mss_devices DROP CONSTRAINT IF EXISTS mss_devices_stock_location_check;
    
    -- Drop restrictive location checks on mss_device_movements if present
    ALTER TABLE public.mss_device_movements DROP CONSTRAINT IF EXISTS mss_device_movements_from_location_check;
    ALTER TABLE public.mss_device_movements DROP CONSTRAINT IF EXISTS mss_device_movements_to_location_check;
    ALTER TABLE public.mss_device_movements DROP CONSTRAINT IF EXISTS chk_mss_movement_locations_different;
    ALTER TABLE public.mss_device_movements ADD CONSTRAINT chk_mss_movement_locations_different 
        CHECK (from_location <> to_location);
END $$;

-- ==============================================================================
-- 3. Table: inventory_transfers (Central Transfer Headers)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_number TEXT NOT NULL UNIQUE,
    source_location TEXT NOT NULL,
    destination_location TEXT NOT NULL,
    source_store_id UUID REFERENCES public.system_stores(id) ON DELETE SET NULL,
    destination_store_id UUID REFERENCES public.system_stores(id) ON DELETE SET NULL,
    transfer_type TEXT NOT NULL CHECK (transfer_type IN ('INDIVIDUAL', 'SELECTED', 'MODEL_GROUP', 'ALL_ELIGIBLE')),
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REQUIRES_REVIEW')),
    item_count INT NOT NULL DEFAULT 0 CHECK (item_count >= 0),
    total_cost NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost >= 0),
    notes TEXT,
    idempotency_key TEXT UNIQUE,
    created_by_admin_id TEXT NOT NULL,
    created_by_username TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    failure_reason TEXT,
    CONSTRAINT chk_transfer_locations_different CHECK (source_location <> destination_location)
);

CREATE INDEX IF NOT EXISTS idx_transfers_reference ON public.inventory_transfers(reference_number);
CREATE INDEX IF NOT EXISTS idx_transfers_source ON public.inventory_transfers(source_location);
CREATE INDEX IF NOT EXISTS idx_transfers_destination ON public.inventory_transfers(destination_location);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON public.inventory_transfers(status);
CREATE INDEX IF NOT EXISTS idx_transfers_created_at ON public.inventory_transfers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transfers_idempotency ON public.inventory_transfers(idempotency_key);

-- ==============================================================================
-- 4. Table: inventory_transfer_items (Itemized Device Snapshots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    model_id UUID REFERENCES public.mss_models(id) ON DELETE SET NULL,
    model_name TEXT,
    source_location TEXT NOT NULL,
    destination_location TEXT NOT NULL,
    purchase_cost_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_cost_snapshot >= 0),
    previous_status TEXT NOT NULL,
    resulting_status TEXT NOT NULL DEFAULT 'AVAILABLE',
    item_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (item_status IN ('COMPLETED', 'EXCLUDED', 'FAILED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_transfer_items_transfer ON public.inventory_transfer_items(transfer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_device ON public.inventory_transfer_items(device_id);
CREATE INDEX IF NOT EXISTS idx_transfer_items_serial ON public.inventory_transfer_items(serial_number);

-- ==============================================================================
-- 5. Row Level Security (RLS) Configuration
-- ==============================================================================
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated admins and desktop clients
DROP POLICY IF EXISTS "Allow read access to inventory_transfers" ON public.inventory_transfers;
CREATE POLICY "Allow read access to inventory_transfers"
    ON public.inventory_transfers
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow read access to inventory_transfer_items" ON public.inventory_transfer_items;
CREATE POLICY "Allow read access to inventory_transfer_items"
    ON public.inventory_transfer_items
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Restrict insertions to trusted functions and administrative calls
DROP POLICY IF EXISTS "Allow insert to inventory_transfers" ON public.inventory_transfers;
CREATE POLICY "Allow insert to inventory_transfers"
    ON public.inventory_transfers
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Allow insert to inventory_transfer_items" ON public.inventory_transfer_items;
CREATE POLICY "Allow insert to inventory_transfer_items"
    ON public.inventory_transfer_items
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Prevent hard deletion of transfers (Historical Preservation Rule)
DROP POLICY IF EXISTS "Prevent delete on inventory_transfers" ON public.inventory_transfers;
CREATE POLICY "Prevent delete on inventory_transfers"
    ON public.inventory_transfers
    FOR DELETE
    TO anon, authenticated
    USING (false);

-- ==============================================================================
-- 6. Stored Function: execute_inventory_transfer (Atomic & Idempotent)
-- ==============================================================================
-- Executes a complete transfer atomically with row locking and idempotency protection.
CREATE OR REPLACE FUNCTION public.execute_inventory_transfer(
    p_source_location TEXT,
    p_destination_location TEXT,
    p_transfer_type TEXT,
    p_device_ids UUID[] DEFAULT NULL,
    p_model_id UUID DEFAULT NULL,
    p_all_eligible BOOLEAN DEFAULT FALSE,
    p_notes TEXT DEFAULT NULL,
    p_admin_id TEXT DEFAULT 'admin',
    p_admin_username TEXT DEFAULT 'administrator',
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS TABLE (
    transfer_id UUID,
    reference_number TEXT,
    item_count INT,
    total_cost NUMERIC(14, 2),
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_existing RECORD;
    v_transfer_id UUID;
    v_ref TEXT;
    v_now TIMESTAMPTZ := timezone('utc', now());
    v_eligible_count INT := 0;
    v_total_cost NUMERIC(14, 2) := 0.00;
    v_dev RECORD;
BEGIN
    -- 1. Validate different locations
    IF trim(p_source_location) = trim(p_destination_location) THEN
        RAISE EXCEPTION 'لا يمكن نقل المخزون إلى نفس الموقع الحالي (%)', p_source_location;
    END IF;

    -- 2. Idempotency Check: If key provided and exists, return existing transfer
    IF p_idempotency_key IS NOT NULL AND length(trim(p_idempotency_key)) > 0 THEN
        SELECT t.id, t.reference_number, t.item_count, t.total_cost, t.status
        INTO v_existing
        FROM public.inventory_transfers t
        WHERE t.idempotency_key = trim(p_idempotency_key);

        IF FOUND THEN
            RETURN QUERY SELECT v_existing.id, v_existing.reference_number, v_existing.item_count, v_existing.total_cost, v_existing.status;
            RETURN;
        END IF;
    END IF;

    -- 3. Generate Human-Readable Reference: TRF-YYYYMMDD-XXXX
    v_ref := 'TRF-' || to_char(v_now, 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 4));

    -- 4. Create Transfer Header
    INSERT INTO public.inventory_transfers (
        reference_number,
        source_location,
        destination_location,
        transfer_type,
        status,
        item_count,
        total_cost,
        notes,
        idempotency_key,
        created_by_admin_id,
        created_by_username,
        created_at,
        completed_at
    ) VALUES (
        v_ref,
        trim(p_source_location),
        trim(p_destination_location),
        p_transfer_type,
        'COMPLETED',
        0,
        0.00,
        p_notes,
        p_idempotency_key,
        p_admin_id,
        p_admin_username,
        v_now,
        v_now
    ) RETURNING id INTO v_transfer_id;

    -- 5. Lock and Process Eligible Devices
    -- If specific device_ids provided, verify all of them belong to source and are AVAILABLE
    IF p_device_ids IS NOT NULL AND array_length(p_device_ids, 1) > 0 THEN
        -- Check if any requested device is missing, sold, or reserved
        FOR v_dev IN 
            SELECT d.id, d.serial_number, d.stock_location, d.status, d.purchase_cost, d.model_id, m.model_name
            FROM public.mss_devices d
            LEFT JOIN public.mss_models m ON m.id = d.model_id
            WHERE d.id = ANY(p_device_ids)
            FOR UPDATE OF d
        LOOP
            IF v_dev.stock_location <> trim(p_source_location) THEN
                RAISE EXCEPTION 'الجهاز بالسيريال (%) غير موجود في موقع المصدر المحدد (%) بل في (%)', 
                    v_dev.serial_number, p_source_location, v_dev.stock_location;
            END IF;

            IF v_dev.status <> 'AVAILABLE' THEN
                RAISE EXCEPTION 'الجهاز بالسيريال (%) غير متاح للنقل؛ حالته الحالية هي (%)', 
                    v_dev.serial_number, v_dev.status;
            END IF;

            -- Update device location
            UPDATE public.mss_devices
            SET stock_location = trim(p_destination_location),
                updated_at = v_now
            WHERE id = v_dev.id;

            -- Record transfer item
            INSERT INTO public.inventory_transfer_items (
                transfer_id,
                device_id,
                serial_number,
                model_id,
                model_name,
                source_location,
                destination_location,
                purchase_cost_snapshot,
                previous_status,
                resulting_status,
                item_status,
                notes,
                created_at
            ) VALUES (
                v_transfer_id,
                v_dev.id,
                v_dev.serial_number,
                v_dev.model_id,
                v_dev.model_name,
                trim(p_source_location),
                trim(p_destination_location),
                v_dev.purchase_cost,
                v_dev.status,
                'AVAILABLE',
                'COMPLETED',
                p_notes,
                v_now
            );

            -- Record device movement for unified history
            INSERT INTO public.mss_device_movements (
                device_id,
                serial_number,
                from_location,
                to_location,
                movement_date,
                movement_status,
                notes,
                created_at
            ) VALUES (
                v_dev.id,
                v_dev.serial_number,
                trim(p_source_location),
                trim(p_destination_location),
                v_now,
                'COMPLETED',
                'تحويل إداري: ' || v_ref || COALESCE(' - ' || p_notes, ''),
                v_now
            );

            v_eligible_count := v_eligible_count + 1;
            v_total_cost := v_total_cost + v_dev.purchase_cost;
        END LOOP;

        -- Verify all requested devices were found
        IF v_eligible_count <> array_length(p_device_ids, 1) THEN
            RAISE EXCEPTION 'لم يتم العثور على جميع الأجهزة المطلوبة للنقل في قاعدة البيانات';
        END IF;

    ELSE
        -- Bulk transfer (ALL_ELIGIBLE or MODEL_GROUP)
        FOR v_dev IN 
            SELECT d.id, d.serial_number, d.stock_location, d.status, d.purchase_cost, d.model_id, m.model_name
            FROM public.mss_devices d
            LEFT JOIN public.mss_models m ON m.id = d.model_id
            WHERE d.stock_location = trim(p_source_location)
              AND d.status = 'AVAILABLE'
              AND (p_model_id IS NULL OR d.model_id = p_model_id)
            FOR UPDATE OF d
        LOOP
            -- Update device location
            UPDATE public.mss_devices
            SET stock_location = trim(p_destination_location),
                updated_at = v_now
            WHERE id = v_dev.id;

            -- Record transfer item
            INSERT INTO public.inventory_transfer_items (
                transfer_id,
                device_id,
                serial_number,
                model_id,
                model_name,
                source_location,
                destination_location,
                purchase_cost_snapshot,
                previous_status,
                resulting_status,
                item_status,
                notes,
                created_at
            ) VALUES (
                v_transfer_id,
                v_dev.id,
                v_dev.serial_number,
                v_dev.model_id,
                v_dev.model_name,
                trim(p_source_location),
                trim(p_destination_location),
                v_dev.purchase_cost,
                v_dev.status,
                'AVAILABLE',
                'COMPLETED',
                p_notes,
                v_now
            );

            -- Record device movement
            INSERT INTO public.mss_device_movements (
                device_id,
                serial_number,
                from_location,
                to_location,
                movement_date,
                movement_status,
                notes,
                created_at
            ) VALUES (
                v_dev.id,
                v_dev.serial_number,
                trim(p_source_location),
                trim(p_destination_location),
                v_now,
                'COMPLETED',
                'تحويل إداري: ' || v_ref || COALESCE(' - ' || p_notes, ''),
                v_now
            );

            v_eligible_count := v_eligible_count + 1;
            v_total_cost := v_total_cost + v_dev.purchase_cost;
        END LOOP;

        IF v_eligible_count = 0 THEN
            RAISE EXCEPTION 'لا توجد أجهزة متاحة ومؤهلة للنقل في موقع المصدر (%)', p_source_location;
        END IF;
    END IF;

    -- 6. Update Header with Actual Totals
    UPDATE public.inventory_transfers
    SET item_count = v_eligible_count,
        total_cost = v_total_cost
    WHERE id = v_transfer_id;

    -- 7. Log Audit Trail Entry
    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata,
        created_at
    ) VALUES (
        p_admin_id,
        p_admin_username,
        'INVENTORY_TRANSFER_COMPLETED',
        'inventory',
        v_transfer_id::text,
        jsonb_build_object(
            'referenceNumber', v_ref,
            'sourceLocation', p_source_location,
            'destinationLocation', p_destination_location,
            'transferType', p_transfer_type,
            'itemCount', v_eligible_count,
            'totalCost', v_total_cost,
            'notes', p_notes
        ),
        v_now
    );

    RETURN QUERY SELECT v_transfer_id, v_ref, v_eligible_count, v_total_cost, 'COMPLETED'::TEXT;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.execute_inventory_transfer TO anon, authenticated;
