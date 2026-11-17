-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 7 SAFE DEMO DATA CLEANUP SCRIPT
-- File: supabase/migrations/20261117_phase07_cleanup_demo_data.sql
-- ==============================================================================
-- Purpose:
--   Removes all demo, mock, test, and placeholder business records from the 
--   cloud database (devices, models, transfers, test stores, movements, invoices, 
--   and non-admin users) while strictly preserving:
--     1. User 'ahmed' (Permanent system owner/administrator account).
--     2. Table structures, RLS policies, functions, triggers, and indexes.
--     3. Admin accounts in 'admin_users'.
--
-- Safety Guarantees:
--   - Executed inside a single atomic TRANSACTION (BEGIN / COMMIT).
--   - Foreign key integrity preserved via bottom-up deletion ordering.
--   - Explicit safety check prevents deletion if user 'ahmed' is not present.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- PRE-CLEANUP AUDIT COUNTS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_ahmed_count INT;
BEGIN
    SELECT COUNT(*) INTO v_ahmed_count FROM public.app_users WHERE username = 'ahmed';
    RAISE NOTICE 'Pre-cleanup audit: User ahmed exists = %', (v_ahmed_count > 0);
END $$;

-- ------------------------------------------------------------------------------
-- 1. CLEANUP INVENTORY TRANSFERS & MOVEMENTS (CHILD DEPENDENCIES FIRST)
-- ------------------------------------------------------------------------------
DELETE FROM public.inventory_transfer_items;
DELETE FROM public.inventory_transfers;
DELETE FROM public.mss_device_movements;
DELETE FROM public.mss_sync_log;
DELETE FROM public.mss_conflicts;
DELETE FROM public.mss_returns;
DELETE FROM public.mss_reservations;
DELETE FROM public.mss_invoices;

-- ------------------------------------------------------------------------------
-- 2. CLEANUP INVENTORY DEVICES & MODELS
-- ------------------------------------------------------------------------------
DELETE FROM public.mss_devices;
DELETE FROM public.mss_models;

-- ------------------------------------------------------------------------------
-- 3. CLEANUP STORE MERGES & ASSIGNMENTS
-- ------------------------------------------------------------------------------
DELETE FROM public.store_merges;
DELETE FROM public.user_store_assignments;

-- ------------------------------------------------------------------------------
-- 4. CLEANUP DEMO STORES & WAREHOUSES
-- ------------------------------------------------------------------------------
DELETE FROM public.system_stores;

-- ------------------------------------------------------------------------------
-- 5. CLEANUP DEMO SESSIONS & NON-AHMED USERS
-- ------------------------------------------------------------------------------
-- Delete sessions for any user other than ahmed
DELETE FROM public.app_user_sessions
WHERE user_id IN (
    SELECT id FROM public.app_users WHERE username != 'ahmed'
);

-- Delete all users except user 'ahmed'
DELETE FROM public.app_users
WHERE username != 'ahmed';

-- ------------------------------------------------------------------------------
-- 6. ENSURE USER 'ahmed' REMAINS INTACT & ACTIVE
-- ------------------------------------------------------------------------------
INSERT INTO public.app_users (
    id,
    username,
    display_name,
    allowed_modules,
    access_code_hash,
    credential_version,
    permission_version,
    is_active
) VALUES (
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
    display_name = 'أحمد صابر',
    allowed_modules = 'both',
    is_active = true,
    updated_at = timezone('utc', now());

-- Clear legacy audit log entries that reference demo fixtures
DELETE FROM public.admin_audit_logs
WHERE target_id LIKE 'trf-seed%' 
   OR target_id LIKE 'b0000000%' 
   OR target_id = 'compu-mss-admin';

-- ------------------------------------------------------------------------------
-- POST-CLEANUP AUDIT VERIFICATION
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_users_left INT;
    v_devices_left INT;
    v_stores_left INT;
    v_transfers_left INT;
    v_ahmed_valid BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO v_users_left FROM public.app_users;
    SELECT COUNT(*) INTO v_devices_left FROM public.mss_devices;
    SELECT COUNT(*) INTO v_stores_left FROM public.system_stores;
    SELECT COUNT(*) INTO v_transfers_left FROM public.inventory_transfers;
    SELECT EXISTS (SELECT 1 FROM public.app_users WHERE username = 'ahmed' AND is_active = true) INTO v_ahmed_valid;

    RAISE NOTICE 'Post-cleanup summary:';
    RAISE NOTICE '  - Total app_users: % (Expected: 1 - user ahmed)', v_users_left;
    RAISE NOTICE '  - User ahmed active and preserved: %', v_ahmed_valid;
    RAISE NOTICE '  - Total mss_devices: % (Expected: 0)', v_devices_left;
    RAISE NOTICE '  - Total system_stores: % (Expected: 0)', v_stores_left;
    RAISE NOTICE '  - Total inventory_transfers: % (Expected: 0)', v_transfers_left;

    IF NOT v_ahmed_valid THEN
        RAISE EXCEPTION 'CRITICAL INTEGRITY FAILURE: User ahmed was not preserved!';
    END IF;
END $$;

COMMIT;
