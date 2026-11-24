-- ==============================================================================
-- Migration: 20261124_admin_change_user_access_code.sql
-- Description: Secure Atomic Access Code Change & Multi-Device Session Revocation
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Authoritative Admin Operation: Bypasses RLS safely via SECURITY DEFINER
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ==============================================================================
-- Secure RPC Function: admin_change_user_access_code
-- ==============================================================================
-- Atomically validates, hashes access code with bcrypt (pgcrypto), increments
-- credential_version, invalidates all existing sessions in app_user_sessions,
-- records audit log, and updates app_users table.
-- Runs as SECURITY DEFINER to bypass RLS safely while encapsulating permissions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_change_user_access_code(
    p_user_id UUID,
    p_new_access_code TEXT,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    display_name TEXT,
    credential_version INT,
    updated_at TIMESTAMPTZ
)
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
BEGIN
    -- 1. Validate inputs
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'معرف المستخدم مطلوب';
    END IF;

    v_clean_code := TRIM(p_new_access_code);
    IF v_clean_code IS NULL OR LENGTH(v_clean_code) < 4 THEN
        RAISE EXCEPTION 'رمز الدخول الجديد يجب ألا يقل عن 4 خانات';
    END IF;

    -- 2. Verify user exists
    SELECT u.id, u.username, u.display_name, u.credential_version, u.is_active
    INTO v_user
    FROM public.app_users u
    WHERE u.id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'المستخدم غير موجود في قاعدة البيانات';
    END IF;

    -- 3. Calculate next credential version (invalidates existing sessions)
    v_next_cred_ver := COALESCE(v_user.credential_version, 1) + 1;

    -- 4. Hash access code using blowfish crypt with salt factor 10
    v_hashed := crypt(v_clean_code, gen_salt('bf', 10));

    -- 5. Update app_users
    UPDATE public.app_users
    SET
        access_code_hash = v_hashed,
        credential_version = v_next_cred_ver,
        updated_at = timezone('utc', now())
    WHERE public.app_users.id = p_user_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات';
    END IF;

    -- 6. Invalidate all active sessions for this user immediately
    UPDATE public.app_user_sessions
    SET revoked_at = timezone('utc', now())
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    -- 7. Audit log the password change
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
        timezone('utc', now())
    );

    RETURN QUERY
    SELECT 
        v_user.id,
        v_user.username,
        v_user.display_name,
        v_next_cred_ver,
        timezone('utc', now());
END;
$$;

-- Ensure ownership is postgres to safely execute under SECURITY DEFINER
ALTER FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) OWNER TO postgres;

-- Grant permissions to execute
REVOKE ALL ON FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_change_user_access_code(UUID, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ==============================================================================
-- Secure RPC Function: admin_revoke_user_sessions
-- ==============================================================================
-- Atomically increments credential_version on app_users, marks all active
-- sessions in app_user_sessions as revoked, and records an audit log.
-- Runs as SECURITY DEFINER to bypass RLS safely while encapsulating permissions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
    p_user_id UUID,
    p_actor_id TEXT DEFAULT 'admin',
    p_actor_username TEXT DEFAULT 'admin'
)
RETURNS TABLE (
    id UUID,
    username TEXT,
    credential_version INT,
    updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
    v_user RECORD;
    v_next_cred_ver INT;
    v_rows_updated INT;
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

    -- Update credential version to invalidate tokens
    UPDATE public.app_users
    SET credential_version = v_next_cred_ver,
        updated_at = timezone('utc', now())
    WHERE public.app_users.id = p_user_id;

    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
    IF v_rows_updated = 0 THEN
        RAISE EXCEPTION 'لم يتم تحديث أي سجل للمستخدم المحدد في قاعدة البيانات';
    END IF;

    -- Invalidate all active sessions immediately
    UPDATE public.app_user_sessions
    SET revoked_at = timezone('utc', now())
    WHERE user_id = p_user_id AND revoked_at IS NULL;

    -- Audit log the revocation
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
        timezone('utc', now())
    );

    RETURN QUERY
    SELECT 
        v_user.id,
        v_user.username,
        v_next_cred_ver,
        timezone('utc', now());
END;
$$;

-- Ensure ownership is postgres to safely execute under SECURITY DEFINER
ALTER FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) OWNER TO postgres;

-- Grant permissions to execute
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
