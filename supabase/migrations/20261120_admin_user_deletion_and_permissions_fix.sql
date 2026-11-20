-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: USER DELETION & PERMISSIONS FIX CONSOLIDATED MIGRATION
-- File: supabase/migrations/20261120_admin_user_deletion_and_permissions_fix.sql
-- Description:
--   1. Secure RPC function: admin_update_app_user (Atomically updates permissions,
--      increments permission_version, syncs sessions, updates store assignments)
--   2. Secure RPC function: admin_delete_app_user (Permanently deletes user,
--      revokes sessions and store assignments, preserves historical business data,
--      prevents self-deletion & last superadmin deletion)
--   3. Safe execution grants & search_path hardening
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Execution: Safe to execute in Supabase SQL Editor in one go (idempotent)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Database Function: admin_update_app_user (Atomic Permissions & User Update)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_update_app_user(
    p_user_id UUID,
    p_display_name TEXT DEFAULT NULL,
    p_username TEXT DEFAULT NULL,
    p_allowed_modules TEXT DEFAULT NULL,
    p_default_store_id UUID DEFAULT NULL,
    p_assigned_store_ids UUID[] DEFAULT NULL,
    p_is_active BOOLEAN DEFAULT NULL,
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
SET search_path = public, pg_temp
AS $$
DECLARE
    v_cur RECORD;
    v_new_perm_ver INT;
    v_norm_username TEXT;
    v_store_id UUID;
BEGIN
    -- 1. Check user exists
    SELECT * INTO v_cur
    FROM public.app_users
    WHERE public.app_users.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود';
    END IF;

    -- 2. Validate username if changed
    IF p_username IS NOT NULL THEN
        v_norm_username := LOWER(TRIM(p_username));
        IF LENGTH(v_norm_username) < 3 THEN
            RAISE EXCEPTION 'اسم المستخدم يجب أن يتكون من 3 أحرف على الأقل';
        END IF;

        IF v_norm_username <> v_cur.username THEN
            IF EXISTS (SELECT 1 FROM public.app_users WHERE public.app_users.username = v_norm_username AND public.app_users.id <> p_user_id) THEN
                RAISE EXCEPTION 'اسم المستخدم "%" مستخدم بالفعل', v_norm_username;
            END IF;
        END IF;
    ELSE
        v_norm_username := v_cur.username;
    END IF;

    -- 3. Calculate permission_version increment
    v_new_perm_ver := COALESCE(v_cur.permission_version, 1);
    IF p_allowed_modules IS NOT NULL AND p_allowed_modules <> v_cur.allowed_modules THEN
        v_new_perm_ver := v_new_perm_ver + 1;
    ELSIF p_is_active IS NOT NULL AND p_is_active <> v_cur.is_active THEN
        v_new_perm_ver := v_new_perm_ver + 1;
    END IF;

    -- 4. Update app_users
    UPDATE public.app_users
    SET
        display_name = COALESCE(TRIM(p_display_name), v_cur.display_name),
        username = v_norm_username,
        allowed_modules = COALESCE(p_allowed_modules, v_cur.allowed_modules),
        default_store_id = CASE WHEN p_default_store_id IS NOT NULL THEN p_default_store_id ELSE v_cur.default_store_id END,
        is_active = COALESCE(p_is_active, v_cur.is_active),
        permission_version = v_new_perm_ver,
        updated_at = timezone('utc', now())
    WHERE public.app_users.id = p_user_id;

    -- 5. If permission_version changed, bump active sessions in app_user_sessions
    IF v_new_perm_ver <> COALESCE(v_cur.permission_version, 1) THEN
        UPDATE public.app_user_sessions
        SET permission_version = v_new_perm_ver
        WHERE public.app_user_sessions.user_id = p_user_id
          AND revoked_at IS NULL;
    END IF;

    -- 6. If store assignments provided, synchronize user_store_assignments
    IF p_assigned_store_ids IS NOT NULL THEN
        DELETE FROM public.user_store_assignments WHERE user_id = p_user_id;

        FOREACH v_store_id IN ARRAY p_assigned_store_ids
        LOOP
            INSERT INTO public.user_store_assignments (user_id, store_id, is_primary)
            VALUES (
                p_user_id,
                v_store_id,
                v_store_id = COALESCE(p_default_store_id, v_cur.default_store_id)
            )
            ON CONFLICT (user_id, store_id) DO NOTHING;
        END LOOP;
    END IF;

    -- 7. Audit log entry
    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata
    ) VALUES (
        p_actor_id,
        p_actor_username,
        'USER_UPDATE',
        'user',
        p_user_id::TEXT,
        jsonb_build_object(
            'previous_modules', v_cur.allowed_modules,
            'new_modules', COALESCE(p_allowed_modules, v_cur.allowed_modules),
            'permission_version', v_new_perm_ver,
            'is_active', COALESCE(p_is_active, v_cur.is_active)
        )
    );

    -- 8. Return updated record
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
    WHERE u.id = p_user_id;
END;
$$;

-- ==============================================================================
-- 3. Database Function: admin_delete_app_user (Permanent Safe User Deletion)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_delete_app_user(
    p_user_id UUID,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_superadmin_count INT;
BEGIN
    -- 1. Prevent self-deletion if user matches calling admin
    IF p_user_id::TEXT = p_actor_id THEN
        RAISE EXCEPTION 'لا يمكنك حذف حسابك الشخصي المسجل به حالياً';
    END IF;

    -- 2. Check if user exists in admin_users and is superadmin
    IF EXISTS (SELECT 1 FROM public.admin_users WHERE id = p_user_id) THEN
        SELECT * INTO v_user FROM public.admin_users WHERE id = p_user_id;
        IF v_user.role = 'superadmin' THEN
            SELECT COUNT(*) INTO v_superadmin_count 
            FROM public.admin_users 
            WHERE role = 'superadmin' AND is_active = true;

            IF v_superadmin_count <= 1 THEN
                RAISE EXCEPTION 'لا يمكن حذف المسؤول الرئيسي الأخير (Super Admin) لضمان استمرارية إدارة النظام';
            END IF;
        END IF;

        -- Delete from admin_users
        DELETE FROM public.admin_users WHERE id = p_user_id;

        -- Log audit
        INSERT INTO public.admin_audit_logs (
            actor_id,
            actor_username,
            event_type,
            target_type,
            target_id,
            metadata
        ) VALUES (
            p_actor_id,
            p_actor_username,
            'ADMIN_DELETE',
            'admin_user',
            p_user_id::TEXT,
            jsonb_build_object(
                'username', v_user.username,
                'display_name', v_user.display_name,
                'role', v_user.role
            )
        );

        RETURN TRUE;
    END IF;

    -- 3. Check if user exists in app_users
    SELECT * INTO v_user FROM public.app_users WHERE id = p_user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود أو تم حذفه مسبقاً';
    END IF;

    -- 4. Delete active desktop sessions
    DELETE FROM public.app_user_sessions WHERE user_id = p_user_id;

    -- 5. Delete store assignments
    DELETE FROM public.user_store_assignments WHERE user_id = p_user_id;

    -- 6. Permanently delete app_users record
    -- (Historical transactions in business tables store username / admin_id strings without cascading delete)
    DELETE FROM public.app_users WHERE id = p_user_id;

    -- 7. Log audit trail
    INSERT INTO public.admin_audit_logs (
        actor_id,
        actor_username,
        event_type,
        target_type,
        target_id,
        metadata
    ) VALUES (
        p_actor_id,
        p_actor_username,
        'USER_DELETE',
        'user',
        p_user_id::TEXT,
        jsonb_build_object(
            'username', v_user.username,
            'display_name', v_user.display_name,
            'allowed_modules', v_user.allowed_modules,
            'default_store_id', v_user.default_store_id
        )
    );

    RETURN TRUE;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.admin_update_app_user TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_app_user TO anon, authenticated, service_role;
