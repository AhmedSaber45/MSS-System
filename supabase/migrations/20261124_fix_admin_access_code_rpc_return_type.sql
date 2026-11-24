-- ==============================================================================
-- Migration: 20261124_fix_admin_access_code_rpc_return_type.sql
-- Description: Permanently Fix PostgreSQL Return Type Mismatch in Access Code Change RPC
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Issue Resolved: "structure of query does not match function result type"
--
-- Root Cause:
--   The previous migration declared:
--     RETURNS TABLE (id UUID, username TEXT, display_name TEXT, credential_version INT, updated_at TIMESTAMPTZ)
--   and used RETURN QUERY SELECT ..., timezone('utc', now()).
--   In PostgreSQL, timezone('utc', now()) returns TIMESTAMP WITHOUT TIME ZONE,
--   which causes a strict type mismatch with declared TIMESTAMPTZ in PL/pgSQL RETURN QUERY.
--   Additionally, variable name collisions between PL/pgSQL OUT variables and query expressions
--   can cause tuple descriptor conflicts.
--
-- Solution:
--   1. Drop existing functions with table return types (DROP FUNCTION required by Postgres
--      when changing a function's return type).
--   2. Switch to a robust, self-describing JSONB scalar return contract (RETURNS JSONB).
--   3. Use jsonb_build_object to construct the response safely and atomically.
--   4. Preserve SECURITY DEFINER, search_path = public, extensions, pg_temp, and postgres ownership.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ==============================================================================
-- 2. Drop existing functions to allow signature/return-type change
-- ==============================================================================
DROP FUNCTION IF EXISTS public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_revoke_user_sessions(UUID, TEXT, TEXT);

-- ==============================================================================
-- 3. Corrected RPC Function: admin_change_user_access_code
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_change_user_access_code(
    p_user_id UUID,
    p_new_access_code TEXT,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_clean_code TEXT;
    v_hashed TEXT;
    v_next_cred_ver INT;
    v_rows_updated INT;
    v_now TIMESTAMPTZ;
BEGIN
    -- 1. Validate inputs
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'معرف المستخدم مطلوب';
    END IF;

    v_clean_code := TRIM(p_new_access_code);
    IF v_clean_code IS NULL OR LENGTH(v_clean_code) < 4 THEN
        RAISE EXCEPTION 'رمز الدخول الجديد يجب ألا يقل عن 4 خانات';
    END IF;

    -- 2. Verify user exists in public.app_users
    SELECT u.id, u.username, u.display_name, u.credential_version, u.is_active
    INTO v_user
    FROM public.app_users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود في قاعدة البيانات';
    END IF;

    -- 3. Calculate next credential version (invalidates existing sessions)
    v_next_cred_ver := COALESCE(v_user.credential_version, 1) + 1;
    v_now := timezone('utc', now());

    -- 4. Hash access code using blowfish crypt with salt factor 10
    v_hashed := extensions.crypt(v_clean_code, extensions.gen_salt('bf', 10));

    -- 5. Update app_users
    UPDATE public.app_users
    SET
        access_code_hash = v_hashed,
        credential_version = v_next_cred_ver,
        updated_at = v_now
    WHERE public.app_users.id = p_user_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات';
    END IF;

    -- 6. Invalidate all active sessions for this user immediately
    UPDATE public.app_user_sessions
    SET revoked_at = v_now
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    -- 7. Audit log the password change without exposing credentials or hashes
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
        'USER_ACCESS_CODE_CHANGE',
        'user',
        p_user_id::TEXT,
        jsonb_build_object(
            'description', 'قام ' || COALESCE(p_actor_username, 'admin') || ' بتغيير رمز الدخول للمستخدم: ' || v_user.username || ' وإبطال كافة جلساته النشطة',
            'note', 'تم تغيير وتشفير رمز الدخول، وزيادة إصدار الأمان وإبطال كافة الجلسات السابقة تلقائياً',
            'credentialVersion', v_next_cred_ver,
            'targetUsername', v_user.username,
            'username', v_user.username,
            'targetDisplayName', v_user.display_name,
            'sessionsRevoked', true,
            'status', 'SUCCESS'
        ),
        v_now
    );

    -- 8. Return explicit, structured JSONB response (no tuple descriptor mismatch)
    RETURN jsonb_build_object(
        'success', true,
        'id', v_user.id,
        'username', v_user.username,
        'display_name', v_user.display_name,
        'credential_version', v_next_cred_ver,
        'sessions_revoked', true,
        'updated_at', v_now,
        'message', 'تم تحديث رمز الدخول بنجاح وإبطال كافة الجلسات النشطة'
    );
END;
$$;

-- Ensure ownership is postgres to safely execute under SECURITY DEFINER
ALTER FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;

-- Grant permissions to execute
REVOKE ALL ON FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- 4. Corrected RPC Function: admin_revoke_user_sessions
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
    p_user_id UUID,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_next_cred_ver INT;
    v_rows_updated INT;
    v_now TIMESTAMPTZ;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'معرف المستخدم مطلوب';
    END IF;

    SELECT u.id, u.username, u.display_name, u.credential_version, u.is_active
    INTO v_user
    FROM public.app_users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود في قاعدة البيانات';
    END IF;

    v_next_cred_ver := COALESCE(v_user.credential_version, 1) + 1;
    v_now := timezone('utc', now());

    -- Update credential version to invalidate tokens
    UPDATE public.app_users
    SET credential_version = v_next_cred_ver,
        updated_at = v_now
    WHERE public.app_users.id = p_user_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات';
    END IF;

    -- Invalidate all active sessions immediately
    UPDATE public.app_user_sessions
    SET revoked_at = v_now
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    -- Audit log the revocation without exposing credentials
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
        'USER_SESSION_REVOKE',
        'user',
        p_user_id::TEXT,
        jsonb_build_object(
            'description', 'قام ' || COALESCE(p_actor_username, 'admin') || ' بإبطال كافة الجلسات النشطة للمستخدم: ' || v_user.username,
            'note', 'تم إبطال كافة جلسات المستخدم النشطة وزيادة إصدار الأمان تلقائياً',
            'credentialVersion', v_next_cred_ver,
            'targetUsername', v_user.username,
            'username', v_user.username,
            'targetDisplayName', v_user.display_name,
            'sessionsRevoked', true,
            'status', 'SUCCESS'
        ),
        v_now
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', v_user.id,
        'username', v_user.username,
        'display_name', v_user.display_name,
        'credential_version', v_next_cred_ver,
        'sessions_revoked', true,
        'updated_at', v_now,
        'message', 'تم إبطال كافة جلسات المستخدم النشطة بنجاح'
    );
END;
$$;

-- Ensure ownership is postgres to safely execute under SECURITY DEFINER
ALTER FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) OWNER TO postgres;

-- Grant permissions to execute
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
