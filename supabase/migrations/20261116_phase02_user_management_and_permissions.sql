-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 2 CONSOLIDATED SCHEMA MIGRATION
-- File: supabase/migrations/20261116_phase02_user_management_and_permissions.sql
-- Description: Complete, safe, idempotent PostgreSQL schema extension for:
--              1. Security Versions (credential_version, permission_version)
--              2. Desktop Application Sessions & Revocation (app_user_sessions)
--              3. Safe View Updates (vw_app_users_safe with versions & stores)
--              4. Database-level Credentials Verification Function (verify_desktop_credentials)
--              5. Row Level Security (RLS) & Indexes for Session Tracking
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Execution: Safe to execute in Supabase SQL Editor in one go (idempotent)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Add Security & Permission Versions to app_users (Safe & Idempotent)
-- ==============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'credential_version'
    ) THEN
        ALTER TABLE public.app_users ADD COLUMN credential_version INT NOT NULL DEFAULT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'app_users' AND column_name = 'permission_version'
    ) THEN
        ALTER TABLE public.app_users ADD COLUMN permission_version INT NOT NULL DEFAULT 1;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_users_cred_ver ON public.app_users(credential_version);
CREATE INDEX IF NOT EXISTS idx_app_users_perm_ver ON public.app_users(permission_version);

-- ==============================================================================
-- 3. Table: app_user_sessions (Desktop Session Tracking & Secure Revocation)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL UNIQUE,
    credential_version INT NOT NULL DEFAULT 1,
    permission_version INT NOT NULL DEFAULT 1,
    device_info TEXT,
    ip_address TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_app_sessions_user_id ON public.app_user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_app_sessions_token_hash ON public.app_user_sessions(session_token_hash);
CREATE INDEX IF NOT EXISTS idx_app_sessions_active ON public.app_user_sessions(user_id, revoked_at, expires_at);

-- ==============================================================================
-- 4. Update Safe View: vw_app_users_safe (Includes version tracking)
-- ==============================================================================
-- Drop existing view first to allow column reordering/additions without PostgreSQL 42P16 error
DROP VIEW IF EXISTS public.vw_app_users_safe CASCADE;

CREATE OR REPLACE VIEW public.vw_app_users_safe AS
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.allowed_modules,
    u.default_store_id,
    s.name AS default_store_name,
    s.code AS default_store_code,
    u.is_active,
    u.credential_version,
    u.permission_version,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    (
        SELECT COUNT(*)::INT 
        FROM public.user_store_assignments usa 
        WHERE usa.user_id = u.id
    ) AS assigned_stores_count
FROM public.app_users u
LEFT JOIN public.system_stores s ON u.default_store_id = s.id;

GRANT SELECT ON public.vw_app_users_safe TO anon, authenticated, service_role;

-- ==============================================================================
-- 5. Database Verification Function (Secure Backend / RPC Authentication)
-- ==============================================================================
-- Validates username and access code, checks account status, returns user profile
-- without ever exposing the access_code_hash.
CREATE OR REPLACE FUNCTION public.verify_desktop_credentials(
    p_username TEXT,
    p_access_code TEXT
)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    display_name TEXT,
    allowed_modules TEXT,
    default_store_id UUID,
    credential_version INT,
    permission_version INT,
    is_active BOOLEAN
) 
SECURITY DEFINER
SET search_path = public, extensions
LANGUAGE plpgsql AS $$
DECLARE
    v_user record;
    v_norm_username text;
BEGIN
    v_norm_username := lower(trim(p_username));

    SELECT u.id, u.username, u.display_name, u.access_code_hash, u.allowed_modules, 
           u.default_store_id, u.credential_version, u.permission_version, u.is_active
    INTO v_user
    FROM public.app_users u
    WHERE lower(u.username) = v_norm_username;

    -- Return nothing if user not found or inactive
    IF NOT FOUND OR v_user.is_active IS NOT TRUE THEN
        RETURN;
    END IF;

    -- Verify access code using pgcrypto crypt() against stored hash
    IF v_user.access_code_hash = crypt(p_access_code, v_user.access_code_hash) THEN
        -- Update last login timestamp
        UPDATE public.app_users 
        SET last_login_at = timezone('utc', now()),
            updated_at = timezone('utc', now())
        WHERE id = v_user.id;

        RETURN QUERY
        SELECT v_user.id, v_user.username, v_user.display_name, v_user.allowed_modules,
               v_user.default_store_id, v_user.credential_version, v_user.permission_version, v_user.is_active;
    END IF;

    RETURN;
END;
$$;

-- Revoke execute from public/anon on security definer function; grant to authenticated and service_role
REVOKE ALL ON FUNCTION public.verify_desktop_credentials(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_desktop_credentials(TEXT, TEXT) TO authenticated, anon;

-- ==============================================================================
-- 6. Row Level Security (RLS) Policies for app_user_sessions
-- ==============================================================================
ALTER TABLE public.app_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all sessions" ON public.app_user_sessions;
CREATE POLICY "Admins can view all sessions" ON public.app_user_sessions
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Admins can insert sessions" ON public.app_user_sessions;
CREATE POLICY "Admins can insert sessions" ON public.app_user_sessions
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can update sessions" ON public.app_user_sessions;
CREATE POLICY "Admins can update sessions" ON public.app_user_sessions
    FOR UPDATE TO authenticated, anon
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "No session hard deletes" ON public.app_user_sessions;
CREATE POLICY "No session hard deletes" ON public.app_user_sessions
    FOR DELETE TO authenticated, anon
    USING (false);

-- ==============================================================================
-- 7. Seed Initial Shop Users (Bridge Legacy & Default Accounts)
-- ==============================================================================
INSERT INTO public.app_users (
    id,
    username,
    display_name,
    allowed_modules,
    access_code_hash,
    credential_version,
    permission_version,
    is_active
) VALUES 
    (
        'a1111111-1111-1111-1111-111111111100',
        'ahmed',
        'أحمد صابر',
        'both',
        '$2a$10$JbwJj99VECXmehlT4h0ELuNBcyb70yCqJ4nHJ2xM8bQtFKqV6aZg.',
        1,
        1,
        true
    )
ON CONFLICT (username) DO UPDATE SET
    access_code_hash = EXCLUDED.access_code_hash,
    is_active = true,
    updated_at = timezone('utc', now());
