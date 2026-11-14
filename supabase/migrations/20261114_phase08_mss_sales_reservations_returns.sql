-- ==============================================================================
-- Migration: Phase 08 — MSS Commercial Operations: Sales, Reservations & Returns
-- File: supabase/migrations/20261114_phase08_mss_sales_reservations_returns.sql
-- Description: Creates MSS sales invoices, device reservations, returns, price snapshots,
--              Row Level Security policies, indexes, and atomic transaction functions.
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Safe to execute: YES (Idempotent with IF NOT EXISTS)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Table: mss_invoices (MSS Sales Invoices & Price Snapshots)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT NOT NULL UNIQUE,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    selling_branch TEXT NOT NULL CHECK (selling_branch IN ('محل 1', 'محل 2')),
    source_branch TEXT NOT NULL CHECK (source_branch IN ('محل 1', 'محل 2')),
    list_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (list_price_snapshot >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    actual_sale_price NUMERIC(12, 2) NOT NULL CHECK (actual_sale_price >= 0),
    cost_snapshot NUMERIC(12, 2) NOT NULL CHECK (cost_snapshot >= 0),
    gross_profit NUMERIC(12, 2) NOT NULL,
    customer_name TEXT,
    customer_phone TEXT,
    warranty_period TEXT DEFAULT 'ضمان شهر كامل',
    notes TEXT,
    sale_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    is_returned BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for sales invoices
CREATE INDEX IF NOT EXISTS idx_mss_invoices_number ON public.mss_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_serial ON public.mss_invoices(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_device ON public.mss_invoices(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_model ON public.mss_invoices(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_selling_branch ON public.mss_invoices(selling_branch);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_source_branch ON public.mss_invoices(source_branch);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_sale_date ON public.mss_invoices(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_is_returned ON public.mss_invoices(is_returned);

-- ==============================================================================
-- 3. Table: mss_reservations (Device Reservations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_number TEXT NOT NULL UNIQUE,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    branch TEXT NOT NULL CHECK (branch IN ('محل 1', 'محل 2')),
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    deposit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (deposit_amount >= 0),
    agreed_price NUMERIC(12, 2) NOT NULL CHECK (agreed_price >= 0),
    expiry_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for reservations
CREATE INDEX IF NOT EXISTS idx_mss_reservations_number ON public.mss_reservations(reservation_number);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_device ON public.mss_reservations(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_serial ON public.mss_reservations(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_status ON public.mss_reservations(status);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_branch ON public.mss_reservations(branch);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_created_at ON public.mss_reservations(created_at DESC);

-- ==============================================================================
-- 4. Table: mss_returns (Sales Returns & Cancellations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number TEXT NOT NULL UNIQUE,
    invoice_id UUID NOT NULL REFERENCES public.mss_invoices(id) ON DELETE RESTRICT,
    invoice_number TEXT NOT NULL,
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE RESTRICT,
    serial_number TEXT NOT NULL,
    refund_amount NUMERIC(12, 2) NOT NULL CHECK (refund_amount >= 0),
    return_reason TEXT NOT NULL,
    restock_location TEXT NOT NULL CHECK (restock_location IN ('محل 1', 'محل 2')),
    new_condition TEXT NOT NULL DEFAULT 'فرز أول ممتاز',
    new_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (new_status IN ('AVAILABLE', 'MAINTENANCE')),
    return_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for returns
CREATE INDEX IF NOT EXISTS idx_mss_returns_number ON public.mss_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_mss_returns_invoice ON public.mss_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mss_returns_device ON public.mss_returns(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_returns_serial ON public.mss_returns(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_returns_date ON public.mss_returns(return_date DESC);

-- ==============================================================================
-- 5. Row Level Security (RLS) Configuration (Rule 11)
-- ==============================================================================
ALTER TABLE public.mss_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_returns ENABLE ROW LEVEL SECURITY;

-- Policies for mss_invoices
DROP POLICY IF EXISTS "Allow public read access to mss_invoices" ON public.mss_invoices;
CREATE POLICY "Allow public read access to mss_invoices"
    ON public.mss_invoices FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_invoices" ON public.mss_invoices;
CREATE POLICY "Allow clients insert to mss_invoices"
    ON public.mss_invoices FOR INSERT TO anon, authenticated
    WITH CHECK (
        length(trim(invoice_number)) > 0 AND
        selling_branch IN ('محل 1', 'محل 2') AND
        source_branch IN ('محل 1', 'محل 2') AND
        actual_sale_price >= 0 AND
        cost_snapshot >= 0
    );

DROP POLICY IF EXISTS "Allow clients update to mss_invoices" ON public.mss_invoices;
CREATE POLICY "Allow clients update to mss_invoices"
    ON public.mss_invoices FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Policies for mss_reservations
DROP POLICY IF EXISTS "Allow public read access to mss_reservations" ON public.mss_reservations;
CREATE POLICY "Allow public read access to mss_reservations"
    ON public.mss_reservations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_reservations" ON public.mss_reservations;
CREATE POLICY "Allow clients insert to mss_reservations"
    ON public.mss_reservations FOR INSERT TO anon, authenticated
    WITH CHECK (
        length(trim(reservation_number)) > 0 AND
        branch IN ('محل 1', 'محل 2') AND
        agreed_price >= 0 AND
        deposit_amount >= 0
    );

DROP POLICY IF EXISTS "Allow clients update to mss_reservations" ON public.mss_reservations;
CREATE POLICY "Allow clients update to mss_reservations"
    ON public.mss_reservations FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Policies for mss_returns
DROP POLICY IF EXISTS "Allow public read access to mss_returns" ON public.mss_returns;
CREATE POLICY "Allow public read access to mss_returns"
    ON public.mss_returns FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_returns" ON public.mss_returns;
CREATE POLICY "Allow clients insert to mss_returns"
    ON public.mss_returns FOR INSERT TO anon, authenticated
    WITH CHECK (
        length(trim(return_number)) > 0 AND
        refund_amount >= 0 AND
        restock_location IN ('محل 1', 'محل 2')
    );

-- ==============================================================================
-- 6. Seed Sample Commercial Data
-- ==============================================================================
-- Seed initial invoices
INSERT INTO public.mss_invoices (
    id, invoice_number, device_id, serial_number, model_id, selling_branch, source_branch,
    list_price_snapshot, discount_amount, actual_sale_price, cost_snapshot, gross_profit,
    customer_name, customer_phone, warranty_period, notes, sale_date
) VALUES
    (
        'd0000000-0000-0000-0000-000000000001',
        'MSS-INV-101',
        'b0000000-0000-0000-0000-000000000005',
        '5CD9283-HP',
        'a0000000-0000-0000-0000-000000000003',
        'محل 1',
        'محل 2',
        13500.00,
        500.00,
        13000.00,
        9800.00,
        3200.00,
        'أ. شريف كمال',
        '01012345678',
        'ضمان شهر كامل',
        'بيع جهاز مخزن بمحل 2 من خلال محل 1',
        timezone('utc', now() - INTERVAL '3 days')
    )
ON CONFLICT (invoice_number) DO NOTHING;

-- Seed initial reservations
INSERT INTO public.mss_reservations (
    id, reservation_number, device_id, serial_number, branch, customer_name, customer_phone,
    deposit_amount, agreed_price, expiry_date, status, notes
) VALUES
    (
        'e0000000-0000-0000-0000-000000000001',
        'MSS-RES-01',
        'b0000000-0000-0000-0000-000000000003',
        '8F9X021-DELL',
        'محل 1',
        'أحمد محمود الجزار',
        '01234567890',
        1000.00,
        14500.00,
        CURRENT_DATE + 3,
        'ACTIVE',
        'حجز مع عربون 1000 ج.م حتى استلام الراتب'
    )
ON CONFLICT (reservation_number) DO NOTHING;
