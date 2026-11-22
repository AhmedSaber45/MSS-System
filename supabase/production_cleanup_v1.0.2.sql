-- ==============================================================================
-- Compu MSS System - Production Database Cleanup & Version Release v1.0.2
-- Script: supabase/production_cleanup_v1.0.2.sql
-- Target: Supabase PostgreSQL Database (ylareolroigqcglayeyg)
-- 
-- IMPORTANT SAFETY NOTICE:
-- 1. This script purges ALL dummy, demo, placeholder, and test business data
--    from the Compu MSS and Admin Dashboard tables in Supabase.
-- 2. Complete JSON snapshot of pre-cleanup data is preserved locally in:
--    backups/pre_v1.0.2_cleanup/supabase_snapshot_pre_v1.0.2.json
-- 3. Run this script in the Supabase SQL Editor:
--    https://supabase.com/dashboard/project/ylareolroigqcglayeyg/sql
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. DIAGNOSTIC: Pre-Cleanup Record Counts
-- ------------------------------------------------------------------------------
SELECT 'BEFORE_CLEANUP' AS audit_checkpoint,
       'system_stores' AS table_name, count(*) AS records FROM public.system_stores
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_models', count(*) FROM public.mss_models
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_devices', count(*) FROM public.mss_devices
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_device_movements', count(*) FROM public.mss_device_movements
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_invoices', count(*) FROM public.mss_invoices
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_invoice_items', count(*) FROM public.mss_invoice_items
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_reservations', count(*) FROM public.mss_reservations
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_reservation_items', count(*) FROM public.mss_reservation_items
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_returns', count(*) FROM public.mss_returns
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_payments', count(*) FROM public.mss_payments
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_installment_schedules', count(*) FROM public.mss_installment_schedules
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_expenses', count(*) FROM public.mss_expenses
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_conflicts', count(*) FROM public.mss_conflicts
UNION ALL SELECT 'BEFORE_CLEANUP', 'mss_sync_log', count(*) FROM public.mss_sync_log
UNION ALL SELECT 'BEFORE_CLEANUP', 'inventory_transfers', count(*) FROM public.inventory_transfers
UNION ALL SELECT 'BEFORE_CLEANUP', 'inventory_transfer_items', count(*) FROM public.inventory_transfer_items
UNION ALL SELECT 'BEFORE_CLEANUP', 'user_store_assignments', count(*) FROM public.user_store_assignments
UNION ALL SELECT 'BEFORE_CLEANUP', 'store_merges', count(*) FROM public.store_merges
UNION ALL SELECT 'BEFORE_CLEANUP', 'app_user_sessions', count(*) FROM public.app_user_sessions
UNION ALL SELECT 'BEFORE_CLEANUP', 'app_users', count(*) FROM public.app_users
UNION ALL SELECT 'BEFORE_CLEANUP', 'admin_audit_logs', count(*) FROM public.admin_audit_logs
UNION ALL SELECT 'BEFORE_CLEANUP', 'admin_users', count(*) FROM public.admin_users;

-- ------------------------------------------------------------------------------
-- 2. SAFE PURGE: Dependency-Aware Truncation with CASCADE & Sequence Reset
-- ------------------------------------------------------------------------------

-- Child items & transactions first
TRUNCATE TABLE
  public.mss_reservation_items,
  public.mss_reservations,
  public.mss_invoice_items,
  public.mss_installment_schedules,
  public.mss_payments,
  public.mss_returns,
  public.mss_invoices,
  public.inventory_transfer_items,
  public.inventory_transfers,
  public.mss_device_movements,
  public.mss_devices,
  public.mss_models,
  public.mss_expenses,
  public.mss_conflicts,
  public.mss_sync_log,
  public.user_store_assignments,
  public.store_merges,
  public.system_stores,
  public.app_user_sessions,
  public.app_users,
  public.admin_audit_logs,
  public.admin_users
RESTART IDENTITY CASCADE;

-- Handle legacy or optional alias tables safely if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mss_movements') THEN
    EXECUTE 'TRUNCATE TABLE public.mss_movements RESTART IDENTITY CASCADE';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'mss_return_items') THEN
    EXECUTE 'TRUNCATE TABLE public.mss_return_items RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. RESET SEQUENCES & IDENTITY COUNTERS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  seq_record RECORD;
BEGIN
  FOR seq_record IN
    SELECT sequence_schema, sequence_name
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH 1', seq_record.sequence_schema, seq_record.sequence_name);
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. DIAGNOSTIC: Post-Cleanup Verification Counts (Must All Be 0)
-- ------------------------------------------------------------------------------
SELECT 'AFTER_CLEANUP' AS audit_checkpoint,
       'system_stores' AS table_name, count(*) AS records FROM public.system_stores
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_models', count(*) FROM public.mss_models
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_devices', count(*) FROM public.mss_devices
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_device_movements', count(*) FROM public.mss_device_movements
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_invoices', count(*) FROM public.mss_invoices
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_invoice_items', count(*) FROM public.mss_invoice_items
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_reservations', count(*) FROM public.mss_reservations
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_reservation_items', count(*) FROM public.mss_reservation_items
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_returns', count(*) FROM public.mss_returns
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_payments', count(*) FROM public.mss_payments
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_installment_schedules', count(*) FROM public.mss_installment_schedules
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_expenses', count(*) FROM public.mss_expenses
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_conflicts', count(*) FROM public.mss_conflicts
UNION ALL SELECT 'AFTER_CLEANUP', 'mss_sync_log', count(*) FROM public.mss_sync_log
UNION ALL SELECT 'AFTER_CLEANUP', 'inventory_transfers', count(*) FROM public.inventory_transfers
UNION ALL SELECT 'AFTER_CLEANUP', 'inventory_transfer_items', count(*) FROM public.inventory_transfer_items
UNION ALL SELECT 'AFTER_CLEANUP', 'user_store_assignments', count(*) FROM public.user_store_assignments
UNION ALL SELECT 'AFTER_CLEANUP', 'store_merges', count(*) FROM public.store_merges
UNION ALL SELECT 'AFTER_CLEANUP', 'app_user_sessions', count(*) FROM public.app_user_sessions
UNION ALL SELECT 'AFTER_CLEANUP', 'app_users', count(*) FROM public.app_users
UNION ALL SELECT 'AFTER_CLEANUP', 'admin_audit_logs', count(*) FROM public.admin_audit_logs
UNION ALL SELECT 'AFTER_CLEANUP', 'admin_users', count(*) FROM public.admin_users;

COMMIT;

-- ==============================================================================
-- End of Cleanup Script v1.0.2
-- Next Step: Run scripts/create_production_superadmin.mjs or execute
-- supabase/production_superadmin_bootstrap.sql to provision the first Super Admin.
-- ==============================================================================
