-- ==============================================================================
-- Migration: Phase 09 — MSS Offline-First Synchronization, Outbox & Conflict Resolution
-- File: supabase/migrations/20261114_phase09_mss_offline_sync.sql
-- Description: Creates MSS cloud synchronization log (idempotency by UUID),
--              conflict tracking table, resolution statuses, and RLS policies.
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Safe to execute: YES (Idempotent with IF NOT EXISTS)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Table: mss_sync_log (Idempotent Cloud Audit Log of Synchronized Operations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_uuid UUID NOT NULL UNIQUE,
    operation_type TEXT NOT NULL CHECK (
        operation_type IN (
            'SALE_CREATE',
            'RESERVATION_CREATE',
            'RESERVATION_CANCEL',
            'RETURN_PROCESS',
            'DEVICE_ADD',
            'DEVICE_TRANSFER'
        )
    ),
    branch TEXT NOT NULL CHECK (branch IN ('محل 1', 'محل 2')),
    payload JSONB NOT NULL,
    client_timestamp TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    status TEXT NOT NULL DEFAULT 'SYNCED' CHECK (status IN ('SYNCED', 'CONFLICT', 'RESOLVED')),
    conflict_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for sync log
CREATE INDEX IF NOT EXISTS idx_mss_sync_log_uuid ON public.mss_sync_log(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_mss_sync_log_type ON public.mss_sync_log(operation_type);
CREATE INDEX IF NOT EXISTS idx_mss_sync_log_branch ON public.mss_sync_log(branch);
CREATE INDEX IF NOT EXISTS idx_mss_sync_log_status ON public.mss_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_mss_sync_log_synced_at ON public.mss_sync_log(synced_at DESC);

-- ==============================================================================
-- 3. Table: mss_conflicts (Detected Disconnected Clashes for Transparent Resolution)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_uuid UUID NOT NULL REFERENCES public.mss_sync_log(operation_uuid) ON DELETE CASCADE,
    device_id UUID REFERENCES public.mss_devices(id) ON DELETE SET NULL,
    serial_number TEXT NOT NULL,
    branch TEXT NOT NULL CHECK (branch IN ('محل 1', 'محل 2')),
    conflict_type TEXT NOT NULL CHECK (
        conflict_type IN (
            'DOUBLE_SALE',
            'DOUBLE_RESERVATION',
            'STALE_STOCK_TRANSFER',
            'DEVICE_NOT_FOUND'
        )
    ),
    conflict_description TEXT NOT NULL,
    local_payload JSONB NOT NULL,
    remote_state JSONB,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
        resolution_status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED_MANUALLY')
    ),
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for conflicts table
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_uuid ON public.mss_conflicts(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_serial ON public.mss_conflicts(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_status ON public.mss_conflicts(resolution_status);
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_created_at ON public.mss_conflicts(created_at DESC);

-- ==============================================================================
-- 4. Row Level Security (RLS) Configuration (Rule 11)
-- ==============================================================================
ALTER TABLE public.mss_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_conflicts ENABLE ROW LEVEL SECURITY;

-- Policies for mss_sync_log
DROP POLICY IF EXISTS "Allow public read access to mss_sync_log" ON public.mss_sync_log;
CREATE POLICY "Allow public read access to mss_sync_log"
    ON public.mss_sync_log FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_sync_log" ON public.mss_sync_log;
CREATE POLICY "Allow clients insert to mss_sync_log"
    ON public.mss_sync_log FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow clients update to mss_sync_log" ON public.mss_sync_log;
CREATE POLICY "Allow clients update to mss_sync_log"
    ON public.mss_sync_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Policies for mss_conflicts
DROP POLICY IF EXISTS "Allow public read access to mss_conflicts" ON public.mss_conflicts;
CREATE POLICY "Allow public read access to mss_conflicts"
    ON public.mss_conflicts FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_conflicts" ON public.mss_conflicts;
CREATE POLICY "Allow clients insert to mss_conflicts"
    ON public.mss_conflicts FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow clients update to mss_conflicts" ON public.mss_conflicts;
CREATE POLICY "Allow clients update to mss_conflicts"
    ON public.mss_conflicts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 5. Seed Sample Sync Audit Entry
-- ==============================================================================
INSERT INTO public.mss_sync_log (
    operation_uuid, operation_type, branch, payload, client_timestamp, status
) VALUES (
    'f0000000-0000-0000-0000-000000000001',
    'SALE_CREATE',
    'محل 1',
    '{"invoice_number": "MSS-INV-101", "serial_number": "5CD9283-HP", "actual_sale_price": 13000}'::jsonb,
    timezone('utc', now() - INTERVAL '3 days'),
    'SYNCED'
) ON CONFLICT (operation_uuid) DO NOTHING;
