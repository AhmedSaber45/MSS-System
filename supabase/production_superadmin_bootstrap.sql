-- ==============================================================================
-- Compu MSS System - Single Production Super Admin Bootstrap SQL
-- File: supabase/production_superadmin_bootstrap.sql
-- Target: Supabase SQL Editor
-- 
-- Description:
-- Provisions the single production Super Admin account (saberadmin)
-- into both admin_users (Dashboard Administrator) and app_users (Desktop User).
-- Uses PostgreSQL's pgcrypto extension for secure bcrypt password hashing.
-- Enforces the single Super Admin requirement by deactivating legacy accounts.
-- ==============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
    v_admin_id UUID := gen_random_uuid();
    v_username TEXT := 'saberadmin';
    v_email TEXT := 'saberadmin@compumss.com';
    v_password_plain TEXT := '123456@asd';
    v_display_name TEXT := 'أحمد صابر - المدير العام';
    v_access_code_plain TEXT := '123456@asd';
    v_password_hash TEXT;
    v_access_code_hash TEXT;
BEGIN
    -- 1. Generate standard bcrypt hashes with 10 salt rounds
    v_password_hash := crypt(v_password_plain, gen_salt('bf', 10));
    v_access_code_hash := crypt(v_access_code_plain, gen_salt('bf', 10));

    -- 2. Deactivate any previous test/development superadmin accounts
    UPDATE public.admin_users
    SET is_active = false,
        updated_at = timezone('utc', now())
    WHERE username != v_username AND role = 'superadmin';

    -- 3. Upsert saberadmin into public.admin_users (Super Admin role)
    INSERT INTO public.admin_users (
        id,
        username,
        email,
        password_hash,
        display_name,
        role,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_admin_id,
        v_username,
        v_email,
        v_password_hash,
        v_display_name,
        'superadmin',
        true,
        timezone('utc', now()),
        timezone('utc', now())
    )
    ON CONFLICT (username) DO UPDATE SET
        email = EXCLUDED.email,
        password_hash = EXCLUDED.password_hash,
        display_name = EXCLUDED.display_name,
        role = 'superadmin',
        is_active = true,
        updated_at = timezone('utc', now());

    -- 4. Upsert saberadmin into public.app_users (Full access to all modules)
    INSERT INTO public.app_users (
        id,
        username,
        display_name,
        access_code_hash,
        allowed_modules,
        is_active,
        created_at,
        updated_at
    ) VALUES (
        v_admin_id,
        v_username,
        v_display_name,
        v_access_code_hash,
        'both',
        true,
        timezone('utc', now()),
        timezone('utc', now())
    )
    ON CONFLICT (username) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        access_code_hash = EXCLUDED.access_code_hash,
        allowed_modules = 'both',
        is_active = true,
        updated_at = timezone('utc', now());

    RAISE NOTICE 'Production Super Admin provisioned successfully:';
    RAISE NOTICE '  Username: %', v_username;
    RAISE NOTICE '  Email   : %', v_email;
    RAISE NOTICE '  Role    : superadmin';
    RAISE NOTICE '  Status  : Active (Single Production Super Admin)';
END $$;

COMMIT;
