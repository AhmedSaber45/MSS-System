-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 4 CONSOLIDATED MIGRATION
-- Stores, Warehouses & Partner Management, Safe Merging & Historical Preservation
-- Migration File: supabase/migrations/20261117_phase04_stores_and_partners.sql
-- ==============================================================================

-- 1. Extend system_stores with archiving, merge pointer, and combined type
DO $$ 
BEGIN
    -- Update type check constraint to support 'combined'
    ALTER TABLE public.system_stores DROP CONSTRAINT IF EXISTS system_stores_type_check;
    ALTER TABLE public.system_stores ADD CONSTRAINT system_stores_type_check 
        CHECK (type IN ('store', 'warehouse', 'combined'));

    -- Add description column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'system_stores' AND column_name = 'description'
    ) THEN
        ALTER TABLE public.system_stores ADD COLUMN description TEXT;
    END IF;

    -- Add is_archived column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'system_stores' AND column_name = 'is_archived'
    ) THEN
        ALTER TABLE public.system_stores ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- Add archived_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'system_stores' AND column_name = 'archived_at'
    ) THEN
        ALTER TABLE public.system_stores ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;

    -- Add merged_into_id column (successor store pointer)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'system_stores' AND column_name = 'merged_into_id'
    ) THEN
        ALTER TABLE public.system_stores ADD COLUMN merged_into_id UUID REFERENCES public.system_stores(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_system_stores_is_archived ON public.system_stores(is_archived);
CREATE INDEX IF NOT EXISTS idx_system_stores_merged_into ON public.system_stores(merged_into_id);

-- ==============================================================================
-- 2. Table: store_merges (Auditable Merge History & Lineage)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.store_merges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    destination_store_id UUID NOT NULL REFERENCES public.system_stores(id),
    source_store_ids UUID[] NOT NULL,
    affected_user_ids UUID[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED')),
    notes TEXT,
    created_by_admin_id TEXT NOT NULL,
    created_by_username TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_store_merges_dest ON public.store_merges(destination_store_id);
CREATE INDEX IF NOT EXISTS idx_store_merges_created_at ON public.store_merges(created_at);

-- ==============================================================================
-- 3. Database Function: execute_store_merge (Atomic Server-Side Merge Transaction)
-- ==============================================================================
-- Safely merges multiple source stores into a single destination store:
--   1. Validates source and destination locations.
--   2. Prevents merging into itself or already archived stores.
--   3. Soft-archives source stores, marks merged_into_id.
--   4. Reassigns active partner/user memberships to destination.
--   5. Increments permission_version for affected users to trigger session revalidation.
--   6. CRITICAL: Leaves physical inventory, devices, and historical invoices UNTOUCHED.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.execute_store_merge(
    p_source_store_ids UUID[],
    p_destination_store_id UUID,
    p_admin_id TEXT,
    p_admin_username TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
    merge_id UUID,
    merged_stores_count INT,
    affected_users_count INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_merge_id UUID;
    v_dest_store RECORD;
    v_src_count INT;
    v_affected_users UUID[];
    v_affected_count INT := 0;
BEGIN
    -- 1. Validation: At least 2 sources
    IF p_source_store_ids IS NULL OR array_length(p_source_store_ids, 1) < 1 THEN
        RAISE EXCEPTION 'يجب تحديد فرع أو مخزن واحد على الأقل للدمج';
    END IF;

    -- 2. Validation: Destination cannot be in sources
    IF p_destination_store_id = ANY(p_source_store_ids) THEN
        RAISE EXCEPTION 'لا يمكن دمج الفرع في نفسه أو اختياره كفرع مصدر ووجهة في نفس الوقت';
    END IF;

    -- 3. Validation: Destination must exist, be active, and not archived
    SELECT * INTO v_dest_store
    FROM public.system_stores
    WHERE id = p_destination_store_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفرع الوجهة غير موجود';
    END IF;

    IF v_dest_store.is_archived THEN
        RAISE EXCEPTION 'لا يمكن الدمج في فرع مؤرشف';
    END IF;

    -- 4. Validation: Verify source stores exist and not already archived
    SELECT COUNT(*) INTO v_src_count
    FROM public.system_stores
    WHERE id = ANY(p_source_store_ids)
      AND is_archived = false;

    IF v_src_count != array_length(p_source_store_ids, 1) THEN
        RAISE EXCEPTION 'أحد الفروع المصدر المحددة غير موجود أو تمت أرشفته مسبقاً';
    END IF;

    -- 5. Identify affected users
    SELECT ARRAY_AGG(DISTINCT user_id) INTO v_affected_users
    FROM public.user_store_assignments
    WHERE store_id = ANY(p_source_store_ids);

    IF v_affected_users IS NULL THEN
        v_affected_users := '{}';
    END IF;
    v_affected_count := COALESCE(array_length(v_affected_users, 1), 0);

    -- 6. Insert merge tracking record
    INSERT INTO public.store_merges (
        destination_store_id,
        source_store_ids,
        affected_user_ids,
        status,
        notes,
        created_by_admin_id,
        created_by_username
    ) VALUES (
        p_destination_store_id,
        p_source_store_ids,
        v_affected_users,
        'COMPLETED',
        p_notes,
        p_admin_id,
        p_admin_username
    ) RETURNING id INTO v_merge_id;

    -- 7. Archive source stores & point merged_into_id to destination
    UPDATE public.system_stores
    SET 
        is_archived = true,
        is_active = false,
        archived_at = timezone('utc', now()),
        merged_into_id = p_destination_store_id,
        updated_at = timezone('utc', now())
    WHERE id = ANY(p_source_store_ids);

    -- 8. Assign affected users to destination store (if not already assigned)
    IF v_affected_count > 0 THEN
        INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
        SELECT u_id, p_destination_store_id, false
        FROM unnest(v_affected_users) AS u_id
        ON CONFLICT (user_id, store_id) DO NOTHING;

        -- Update default_store_id for users whose default was a source store
        UPDATE public.app_users
        SET 
            default_store_id = p_destination_store_id,
            permission_version = permission_version + 1,
            updated_at = timezone('utc', now())
        WHERE default_store_id = ANY(p_source_store_ids);

        -- Increment permission_version for all affected users so desktop sessions revalidate
        UPDATE public.app_users
        SET 
            permission_version = permission_version + 1,
            updated_at = timezone('utc', now())
        WHERE id = ANY(v_affected_users)
          AND default_store_id != p_destination_store_id;
    END IF;

    -- 9. Log immutable audit entry
    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata
    ) VALUES (
        p_admin_id,
        p_admin_username,
        'STORE_MERGE_COMPLETED',
        'store',
        p_destination_store_id::TEXT,
        jsonb_build_object(
            'merge_id', v_merge_id,
            'source_store_ids', p_source_store_ids,
            'destination_store_id', p_destination_store_id,
            'affected_users_count', v_affected_count,
            'notes', p_notes,
            'inventory_notice', 'تم دمج الهيكل التنظيمي وصلاحيات الموظفين فقط، ويظل المخزون مسجلاً بموقعه الأصلي لحين تحويله مستقلاً'
        )
    );

    RETURN QUERY SELECT v_merge_id, array_length(p_source_store_ids, 1), v_affected_count;
END;
$$;

-- Enable RLS on store_merges
ALTER TABLE public.store_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to store_merges" ON public.store_merges;
CREATE POLICY "Admins have full access to store_merges" ON public.store_merges
    FOR ALL
    USING (true)
    WITH CHECK (true);
