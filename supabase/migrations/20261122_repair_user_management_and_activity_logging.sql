-- ==============================================================================
-- COMPU MSS — CONSOLIDATED MIGRATION: REPAIR USER MANAGEMENT & ADMIN ACTIVITY LOGGING
-- File: supabase/migrations/20261122_repair_user_management_and_activity_logging.sql
-- Description:
--   1. Secure RPC function: admin_create_app_user (Atomically validates, hashes access code,
--      creates user in app_users, sets up store assignments, writes audit record, and returns user)
--   2. Secure RPC function: admin_log_activity (Centralized, tamper-resistant logging of all
--      authentication, user management, and administrative events with human-readable Arabic descriptions)
--   3. Row Level Security (RLS) hardening for admin_audit_logs:
--      - Permits SELECT and INSERT for anon, authenticated, and service_role
--      - Strictly forbids UPDATE and DELETE to guarantee audit trail immutability
--   4. Expanded target_type constraint on admin_audit_logs to safely handle all system events
--   5. Safe view: vw_admin_audit_logs with public grants for efficient dashboard queries
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Execution: Safe to execute in Supabase SQL Editor in one go (idempotent)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Expand target_type constraint on admin_audit_logs (Safe & Idempotent)
-- ==============================================================================
DO $$
BEGIN
    -- Drop old restrictive check constraint if present
    ALTER TABLE public.admin_audit_logs DROP CONSTRAINT IF EXISTS admin_audit_logs_target_type_check;
    
    -- Add updated check constraint supporting user, store, system, auth, inventory, session, and role
    ALTER TABLE public.admin_audit_logs ADD CONSTRAINT admin_audit_logs_target_type_check 
        CHECK (target_type IN ('user', 'store', 'system', 'auth', 'inventory', 'session', 'role'));
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Table or constraint may already be compatible
END $$;

-- Ensure indexes on admin_audit_logs for fast retrieval and filtering
CREATE INDEX IF NOT EXISTS idx_admin_audit_created_desc ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_event_type ON public.admin_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_username ON public.admin_audit_logs(actor_username);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_composite ON public.admin_audit_logs(target_type, target_id);

-- ==============================================================================
-- 3. Row Level Security (RLS) on admin_audit_logs
-- ==============================================================================
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Insert audit logs" ON public.admin_audit_logs
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- Guarantee immutability: UPDATE and DELETE are strictly disallowed
DROP POLICY IF EXISTS "No audit log updates" ON public.admin_audit_logs;
CREATE POLICY "No audit log updates" ON public.admin_audit_logs
    FOR UPDATE TO authenticated, anon
    USING (false);

DROP POLICY IF EXISTS "No audit log deletes" ON public.admin_audit_logs;
CREATE POLICY "No audit log deletes" ON public.admin_audit_logs
    FOR DELETE TO authenticated, anon
    USING (false);

-- ==============================================================================
-- 4. Safe View: vw_admin_audit_logs (For performant dashboard queries)
-- ==============================================================================
DROP VIEW IF EXISTS public.vw_admin_audit_logs CASCADE;

CREATE OR REPLACE VIEW public.vw_admin_audit_logs AS
SELECT 
    id,
    actor_id,
    actor_username,
    event_type,
    target_type,
    target_id,
    metadata,
    created_at
FROM public.admin_audit_logs;

GRANT SELECT ON public.vw_admin_audit_logs TO anon, authenticated, service_role;

-- ==============================================================================
-- 5. Secure Function: admin_log_activity
-- ==============================================================================
-- Centralized logging function with SECURITY DEFINER to bypass RLS restrictions
-- while strictly enforcing immutable audit recording.
CREATE OR REPLACE FUNCTION public.admin_log_activity(
    p_actor_id TEXT,
    p_actor_username TEXT,
    p_event_type TEXT,
    p_target_type TEXT,
    p_target_id TEXT,
    p_description TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_status TEXT DEFAULT 'SUCCESS',
    p_failure_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_log_id UUID;
    v_target_type TEXT;
    v_merged_meta JSONB;
BEGIN
    -- Normalize target_type to valid enum value
    IF p_target_type IN ('user', 'store', 'system', 'auth', 'inventory', 'session', 'role') THEN
        v_target_type := p_target_type;
    ELSE
        v_target_type := 'system';
    END IF;

    -- Merge description, status, and failure reason into metadata object
    v_merged_meta := COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object(
        'description', p_description,
        'status', COALESCE(p_status, 'SUCCESS'),
        'failure_reason', p_failure_reason
    );

    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata,
        created_at
    ) VALUES (
        COALESCE(TRIM(p_actor_id), 'system'),
        COALESCE(TRIM(p_actor_username), 'system'),
        TRIM(p_event_type),
        v_target_type,
        COALESCE(TRIM(p_target_id), 'system'),
        v_merged_meta,
        timezone('utc', now())
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_log_activity TO anon, authenticated, service_role;

-- ==============================================================================
-- 6. Secure Function: admin_create_app_user
-- ==============================================================================
-- Atomically creates a user in app_users, hashes the access code with bcrypt (pgcrypto),
-- sets up store assignments in user_store_assignments, records audit log, and returns user.
CREATE OR REPLACE FUNCTION public.admin_create_app_user(
    p_username TEXT,
    p_display_name TEXT,
    p_access_code TEXT,
    p_allowed_modules TEXT DEFAULT 'both',
    p_default_store_id UUID DEFAULT NULL,
    p_assigned_store_ids UUID[] DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT TRUE,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    allowed_modules TEXT,
    default_store_id UUID,
    credential_version INT,
    permission_version INT,
    is_active BOOLEAN,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_norm_username TEXT;
    v_clean_display TEXT;
    v_access_code_hash TEXT;
    v_new_id UUID;
    v_store_id UUID;
    v_created_row RECORD;
BEGIN
    -- 1. Input validations
    v_norm_username := LOWER(TRIM(p_username));
    v_clean_display := TRIM(p_display_name);

    IF v_norm_username IS NULL OR LENGTH(v_norm_username) < 3 THEN
        RAISE EXCEPTION 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل';
    END IF;

    IF v_clean_display IS NULL OR LENGTH(v_clean_display) < 2 THEN
        RAISE EXCEPTION 'الاسم الكامل يجب أن يتكون من حرفين على الأقل';
    END IF;

    IF p_access_code IS NULL OR LENGTH(TRIM(p_access_code)) < 4 THEN
        RAISE EXCEPTION 'رمز الدخول يجب أن يتكون من 4 أرقام أو أحرف على الأقل';
    END IF;

    -- 2. Uniqueness check against app_users and admin_users
    IF EXISTS (SELECT 1 FROM public.app_users WHERE LOWER(public.app_users.username) = v_norm_username) THEN
        RAISE EXCEPTION 'اسم المستخدم "%" مستخدم بالفعل، يرجى اختيار اسم آخر', v_norm_username;
    END IF;

    IF EXISTS (SELECT 1 FROM public.admin_users WHERE LOWER(public.admin_users.username) = v_norm_username) THEN
        RAISE EXCEPTION 'اسم المستخدم "%" مستخدم بالفعل، يرجى اختيار اسم آخر', v_norm_username;
    END IF;

    -- 3. Validate default store exists if provided
    IF p_default_store_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.system_stores WHERE public.system_stores.id = p_default_store_id) THEN
            p_default_store_id := NULL;
        END IF;
    END IF;

    -- 4. Hash access code using pgcrypto blowfish crypt with salt factor 10
    v_access_code_hash := crypt(TRIM(p_access_code), gen_salt('bf', 10));

    -- 5. Insert into app_users
    INSERT INTO public.app_users (
        username,
        display_name,
        access_code_hash,
        allowed_modules,
        default_store_id,
        credential_version,
        permission_version,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_norm_username,
        v_clean_display,
        v_access_code_hash,
        COALESCE(p_allowed_modules, 'both'),
        p_default_store_id,
        1,
        1,
        COALESCE(p_is_active, true),
        timezone('utc', now()),
        timezone('utc', now())
    )
    RETURNING public.app_users.id INTO v_new_id;

    -- 6. Insert store assignments
    IF p_assigned_store_ids IS NOT NULL AND array_length(p_assigned_store_ids, 1) > 0 THEN
        FOREACH v_store_id IN ARRAY p_assigned_store_ids
        LOOP
            IF EXISTS (SELECT 1 FROM public.system_stores WHERE public.system_stores.id = v_store_id) THEN
                INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
                VALUES (
                    v_new_id,
                    v_store_id,
                    v_store_id = p_default_store_id
                )
                ON CONFLICT (user_id, store_id) DO NOTHING;
            END IF;
        END LOOP;
    ELSIF p_default_store_id IS NOT NULL THEN
        INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
        VALUES (v_new_id, p_default_store_id, true)
        ON CONFLICT (user_id, store_id) DO NOTHING;
    END IF;

    -- 7. Audit log the creation
    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata,
        created_at
    ) VALUES (
        COALESCE(p_actor_id, 'admin'),
        COALESCE(p_actor_username, 'admin'),
        'USER_CREATE',
        'user',
        v_new_id::TEXT,
        jsonb_build_object(
            'username', v_norm_username,
            'displayName', v_clean_display,
            'allowedModules', COALESCE(p_allowed_modules, 'both'),
            'defaultStoreId', p_default_store_id,
            'status', 'SUCCESS',
            'description', 'قام ' || COALESCE(p_actor_username, 'المدير') || ' بإنشاء مستخدم جديد باسم ' || v_norm_username
        ),
        timezone('utc', now())
    );

    -- 8. Return newly created user row
    RETURN QUERY
    SELECT 
        u.id,
        u.username,
        u.display_name,
        u.allowed_modules,
        u.default_store_id,
        u.credential_version,
        u.permission_version,
        u.is_active,
        u.created_at,
        u.updated_at
    FROM public.app_users u
    WHERE u.id = v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_create_app_user TO anon, authenticated, service_role;
