-- ==============================================================================
-- Migration: Phase 02 — Installment Sales & Customer Receivables (Compu MSS)
-- File: supabase/migrations/20261118_phase02_installments_and_customer_receivables.sql
-- Description: Adds deferred/installment payment support to Compu MSS sales invoices,
--              dedicated payment transactions history (with reversal support),
--              planned installment schedules, indexes, RLS policies, and safe backfills.
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Safe to execute: YES (Idempotent with IF NOT EXISTS, DO block column checks, and DROP POLICY IF EXISTS)
-- STATUS: NOT EXECUTED (Ready for execution in Supabase SQL Editor by system administrator)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Extend public.mss_invoices for Deferred Payments & Receivables Tracking
-- ==============================================================================

DO $$
BEGIN
    -- payment_type: FULL (default) or DEFERRED (installment / credit sale)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'payment_type'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN payment_type TEXT NOT NULL DEFAULT 'FULL' 
        CHECK (payment_type IN ('FULL', 'DEFERRED'));
    END IF;

    -- payment_status: PAID, PARTIALLY_PAID, UNPAID, OVERDUE
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PAID' 
        CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'UNPAID', 'OVERDUE'));
    END IF;

    -- paid_amount: Cumulative total amount paid so far
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'paid_amount'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 
        CHECK (paid_amount >= 0);
    END IF;

    -- remaining_balance: Outstanding balance owed by customer
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'remaining_balance'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 
        CHECK (remaining_balance >= 0);
    END IF;

    -- due_date: Next expected payment date (or final due date)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'due_date'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN due_date DATE;
    END IF;

    -- installments_count: Number of planned installments
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'mss_invoices' 
          AND column_name = 'installments_count'
    ) THEN
        ALTER TABLE public.mss_invoices 
        ADD COLUMN installments_count INTEGER NOT NULL DEFAULT 0 
        CHECK (installments_count >= 0);
    END IF;
END $$;

-- Indexes for performance & receivables queries
CREATE INDEX IF NOT EXISTS idx_mss_invoices_payment_status 
    ON public.mss_invoices(payment_status);

CREATE INDEX IF NOT EXISTS idx_mss_invoices_payment_type 
    ON public.mss_invoices(payment_type);

CREATE INDEX IF NOT EXISTS idx_mss_invoices_due_date 
    ON public.mss_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_mss_invoices_remaining_balance 
    ON public.mss_invoices(remaining_balance) 
    WHERE remaining_balance > 0;

-- ==============================================================================
-- 3. Table: public.mss_payments (Dedicated Customer Payment Transactions)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.mss_invoices(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount != 0),
    payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
    payment_method TEXT NOT NULL DEFAULT 'نقدي',
    notes TEXT,
    recorded_by TEXT,
    is_reversal BOOLEAN NOT NULL DEFAULT false,
    reversal_of_id UUID REFERENCES public.mss_payments(id) ON DELETE SET NULL,
    reversal_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for payment transactions
CREATE INDEX IF NOT EXISTS idx_mss_payments_invoice_id 
    ON public.mss_payments(invoice_id);

CREATE INDEX IF NOT EXISTS idx_mss_payments_date 
    ON public.mss_payments(payment_date DESC);

CREATE INDEX IF NOT EXISTS idx_mss_payments_reversal 
    ON public.mss_payments(is_reversal) 
    WHERE is_reversal = true;

-- ==============================================================================
-- 4. Table: public.mss_installment_schedules (Expected Installment Plan)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_installment_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.mss_invoices(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number > 0),
    due_date DATE NOT NULL,
    expected_amount NUMERIC(12, 2) NOT NULL CHECK (expected_amount > 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_mss_invoice_installment UNIQUE (invoice_id, installment_number)
);

-- Indexes for installment schedules
CREATE INDEX IF NOT EXISTS idx_mss_schedules_invoice_id 
    ON public.mss_installment_schedules(invoice_id);

CREATE INDEX IF NOT EXISTS idx_mss_schedules_due_date 
    ON public.mss_installment_schedules(due_date);

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.mss_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_installment_schedules ENABLE ROW LEVEL SECURITY;

-- Policies for mss_payments
DROP POLICY IF EXISTS "Allow public read access to mss_payments" ON public.mss_payments;
CREATE POLICY "Allow public read access to mss_payments"
    ON public.mss_payments FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_payments" ON public.mss_payments;
CREATE POLICY "Allow clients insert to mss_payments"
    ON public.mss_payments FOR INSERT TO anon, authenticated
    WITH CHECK (
        amount != 0 AND
        invoice_id IS NOT NULL
    );

DROP POLICY IF EXISTS "Allow clients update to mss_payments" ON public.mss_payments;
CREATE POLICY "Allow clients update to mss_payments"
    ON public.mss_payments FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

-- Disallow hard deletes on payment transactions to preserve financial audit trail
DROP POLICY IF EXISTS "Disallow hard deletes on mss_payments" ON public.mss_payments;
CREATE POLICY "Disallow hard deletes on mss_payments"
    ON public.mss_payments FOR DELETE TO anon, authenticated
    USING (false);

-- Policies for mss_installment_schedules
DROP POLICY IF EXISTS "Allow public read access to mss_installment_schedules" ON public.mss_installment_schedules;
CREATE POLICY "Allow public read access to mss_installment_schedules"
    ON public.mss_installment_schedules FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_installment_schedules" ON public.mss_installment_schedules;
CREATE POLICY "Allow clients insert to mss_installment_schedules"
    ON public.mss_installment_schedules FOR INSERT TO anon, authenticated
    WITH CHECK (
        expected_amount > 0 AND
        installment_number > 0 AND
        invoice_id IS NOT NULL
    );

DROP POLICY IF EXISTS "Allow clients update to mss_installment_schedules" ON public.mss_installment_schedules;
CREATE POLICY "Allow clients update to mss_installment_schedules"
    ON public.mss_installment_schedules FOR UPDATE TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow clients delete to mss_installment_schedules" ON public.mss_installment_schedules;
CREATE POLICY "Allow clients delete to mss_installment_schedules"
    ON public.mss_installment_schedules FOR DELETE TO anon, authenticated
    USING (true);

-- ==============================================================================
-- 6. Safe Backfill for Historical MSS Invoices
-- Preserve existing invoice totals and mark historical full-payment sales as PAID.
-- ==============================================================================
UPDATE public.mss_invoices
SET 
    payment_type = 'FULL',
    payment_status = 'PAID',
    paid_amount = actual_sale_price,
    remaining_balance = 0.00,
    installments_count = 0
WHERE 
    payment_type IS NULL 
    OR (paid_amount = 0.00 AND remaining_balance = 0.00);

-- End of Migration
