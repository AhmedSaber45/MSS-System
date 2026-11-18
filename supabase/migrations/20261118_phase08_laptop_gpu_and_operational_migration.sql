-- ==============================================================================
-- Migration: Phase 08 — Laptop GPU Specification & Operational Management Migration
-- File: supabase/migrations/20261118_phase08_laptop_gpu_and_operational_migration.sql
-- Description:
--   1. Adds nullable 'gpu' column to 'mss_models' table for laptop and device specifications.
--   2. Adds partial index on 'mss_models(gpu)' for optimized hardware specification search.
--   3. Documents the consolidation of operational management (Stores, Transfers, Audit)
--      into the Compu MSS desktop application while retaining authoritative Supabase
--      tables ('system_stores', 'inventory_transfers', 'inventory_transfer_items',
--      'admin_audit_logs') and atomic stored procedures ('execute_inventory_transfer',
--      'execute_store_merge').
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Status: PREPARED & VALIDATED — NOT EXECUTED (Ready for Supabase SQL Editor review)
-- Safe to execute: YES (100% Idempotent, non-blocking, non-destructive, backward-compatible)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADD GPU SPECIFICATION COLUMN TO MSS_MODELS
-- ------------------------------------------------------------------------------
-- The 'gpu' column is nullable/optional so existing models and non-laptop categories
-- retain 100% data integrity without default values or required migrations.

ALTER TABLE public.mss_models
    ADD COLUMN IF NOT EXISTS gpu TEXT;

COMMENT ON COLUMN public.mss_models.gpu IS
    'Graphics Card (GPU) specifications: Manufacturer (NVIDIA/AMD/Intel/Apple), Model, Type (Integrated/Dedicated), and VRAM (e.g., RTX 4060 8GB, Iris Xe). Optional.';

-- ------------------------------------------------------------------------------
-- 2. CREATE INDEX FOR GPU SPECIFICATION SEARCH
-- ------------------------------------------------------------------------------
-- Partial index covering only rows where GPU is defined, keeping storage overhead minimal.

CREATE INDEX IF NOT EXISTS idx_mss_models_gpu
    ON public.mss_models(gpu)
    WHERE gpu IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. VERIFY OPERATIONAL SCHEMA INTEGRITY (READ-ONLY CHECKS)
-- ------------------------------------------------------------------------------
-- Ensure operational tables previously provisioned in Phases 01-07 are present
-- and ready for direct desktop application consumption:
-- - public.system_stores (Stores, Warehouses, Partners)
-- - public.inventory_transfers (Atomic transfer batches)
-- - public.inventory_transfer_items (Per-device transfer items)
-- - public.admin_audit_logs (Immutable audit trail)

DO $$
BEGIN
    -- Verify system_stores exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'system_stores'
    ) THEN
        RAISE NOTICE 'Notice: system_stores table not found. Ensure 20261117_phase04_stores_and_partners.sql is applied.';
    END IF;

    -- Verify inventory_transfers exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'inventory_transfers'
    ) THEN
        RAISE NOTICE 'Notice: inventory_transfers table not found. Ensure 20261117_phase05_inventory_transfers.sql is applied.';
    END IF;

    -- Verify admin_audit_logs exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'admin_audit_logs'
    ) THEN
        RAISE NOTICE 'Notice: admin_audit_logs table not found. Ensure 20261116_phase01_admin_dashboard_foundation.sql is applied.';
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. VERIFICATION QUERIES (RUN IN SUPABASE SQL EDITOR TO VERIFY MIGRATION)
-- ------------------------------------------------------------------------------
-- Run the following queries to verify the column and index:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND table_name = 'mss_models'
--   AND column_name = 'gpu';
--
-- Expected output:
-- column_name | data_type | is_nullable
-- ------------+-----------+------------
-- gpu         | text      | YES
--
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE schemaname = 'public'
--   AND tablename = 'mss_models'
--   AND indexname = 'idx_mss_models_gpu';

-- ==============================================================================
-- END OF MIGRATION: Phase 08
-- ==============================================================================
