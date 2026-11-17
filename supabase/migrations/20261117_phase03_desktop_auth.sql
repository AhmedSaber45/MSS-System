-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 3 CONSOLIDATED MIGRATION
-- Desktop Authentication, Secure Sessions & Offline Authorization Backend
-- Migration File: supabase/migrations/20261117_phase03_desktop_auth.sql
-- ==============================================================================

-- 1. Ensure last_active_at column exists on app_user_sessions
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_user_sessions' AND column_name = 'last_active_at'
    ) THEN
        ALTER TABLE public.app_user_sessions ADD COLUMN last_active_at TIMESTAMPTZ DEFAULT timezone('utc', now());
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_sessions_last_active ON public.app_user_sessions(last_active_at);

-- ==============================================================================
-- 2. Database Function: revalidate_desktop_session (Atomic Server-Side Revalidation)
-- ==============================================================================
-- Revalidates an existing session using its SHA-256 token hash.
-- Verifies:
--   1. Session exists, not expired, not revoked.
--   2. User exists, is_active is true.
--   3. User credential_version matches session (detects access code change).
--   4. Reflects updated permission_version & allowed_modules.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.revalidate_desktop_session(
    p_session_token_hash TEXT
)
RETURNS TABLE (
    valid BOOLEAN,
    reason TEXT,
    user_id UUID,
    username TEXT,
    display_name TEXT,
    allowed_modules TEXT,
    default_store_id UUID,
    assigned_store_ids UUID[],
    credential_version INT,
    permission_version INT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_session RECORD;
    v_user RECORD;
    v_assigned_stores UUID[];
BEGIN
    -- 1. Lookup session
    SELECT * INTO v_session
    FROM public.app_user_sessions
    WHERE session_token_hash = p_session_token_hash
      AND revoked_at IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'SESSION_REVOKED'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID[], NULL::INT, NULL::INT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 2. Check session expiry
    IF v_session.expires_at <= timezone('utc', now()) THEN
        RETURN QUERY SELECT FALSE, 'SESSION_EXPIRED'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID[], NULL::INT, NULL::INT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 3. Lookup user
    SELECT * INTO v_user
    FROM public.app_users
    WHERE id = v_session.user_id;

    IF NOT FOUND OR NOT v_user.is_active THEN
        RETURN QUERY SELECT FALSE, 'ACCOUNT_DISABLED'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID[], NULL::INT, NULL::INT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 4. Check if access code was changed (credential_version bumped)
    IF v_user.credential_version > v_session.credential_version THEN
        RETURN QUERY SELECT FALSE, 'CREDENTIAL_CHANGED'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::UUID[], NULL::INT, NULL::INT, NULL::TIMESTAMPTZ;
        RETURN;
    END IF;

    -- 5. Collect assigned store IDs
    SELECT ARRAY_AGG(store_id) INTO v_assigned_stores
    FROM public.user_store_assignments
    WHERE user_id = v_user.id;

    IF v_assigned_stores IS NULL AND v_user.default_store_id IS NOT NULL THEN
        v_assigned_stores := ARRAY[v_user.default_store_id];
    END IF;

    -- 6. Update session last_active_at and sync permission_version
    UPDATE public.app_user_sessions
    SET 
        last_active_at = timezone('utc', now()),
        permission_version = v_user.permission_version
    WHERE id = v_session.id;

    RETURN QUERY SELECT 
        TRUE,
        'VALID'::TEXT,
        v_user.id,
        v_user.username,
        v_user.display_name,
        v_user.allowed_modules,
        v_user.default_store_id,
        v_assigned_stores,
        v_user.credential_version,
        v_user.permission_version,
        v_session.expires_at;
END;
$$;

-- ==============================================================================
-- 3. Database Function: revoke_desktop_session (Atomic Logout)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.revoke_desktop_session(
    p_session_token_hash TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.app_user_sessions
    SET revoked_at = timezone('utc', now())
    WHERE session_token_hash = p_session_token_hash
      AND revoked_at IS NULL;

    RETURN TRUE;
END;
$$;
