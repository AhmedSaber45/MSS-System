-- ==============================================================================
-- COMPU MSS — OPERATING EXPENSES MANAGEMENT SYSTEM MIGRATION
-- File: supabase/migrations/20261121_operating_expenses_management_system.sql
-- ==============================================================================
-- Objective:
-- 1. Create public.mss_expenses table for tracking Compu MSS daily operating expenses
--    (salaries, fuel/transport, electricity/utilities, maintenance, rent, supplies, etc.).
-- 2. Store all Compu MSS expenses securely in Supabase with RLS policies.
-- 3. Strictly isolate Compu MSS expenses from the local Accessories SQLite database.
-- 4. Enable seamless integration with offline synchronization via Outbox.
-- 5. Guarantee indexes for high-performance reporting and financial date filtering.
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. Create public.mss_expenses table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    branch TEXT NOT NULL,
    expense_date DATE NOT NULL,
    payment_source TEXT NOT NULL DEFAULT 'أموال الشركة',
    payment_method TEXT NOT NULL DEFAULT 'نقدي (كاش)',
    description TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. Performance Indexes
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_mss_expenses_date 
    ON public.mss_expenses(expense_date);

CREATE INDEX IF NOT EXISTS idx_mss_expenses_branch 
    ON public.mss_expenses(branch);

CREATE INDEX IF NOT EXISTS idx_mss_expenses_category 
    ON public.mss_expenses(category);

CREATE INDEX IF NOT EXISTS idx_mss_expenses_created_at 
    ON public.mss_expenses(created_at DESC);

-- ==============================================================================
-- 4. Updated At Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_mss_expenses_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_mss_expenses_updated_at ON public.mss_expenses;
CREATE TRIGGER trigger_mss_expenses_updated_at
    BEFORE UPDATE ON public.mss_expenses
    FOR EACH ROW
    EXECUTE FUNCTION public.set_mss_expenses_updated_at();

-- ==============================================================================
-- 5. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.mss_expenses ENABLE ROW LEVEL SECURITY;

-- 5.1 Allow authenticated users full read access
DROP POLICY IF EXISTS "Allow authenticated users to read mss_expenses" ON public.mss_expenses;
CREATE POLICY "Allow authenticated users to read mss_expenses"
    ON public.mss_expenses
    FOR SELECT
    TO authenticated
    USING (true);

-- 5.2 Allow authenticated users to insert expenses
DROP POLICY IF EXISTS "Allow authenticated users to insert mss_expenses" ON public.mss_expenses;
CREATE POLICY "Allow authenticated users to insert mss_expenses"
    ON public.mss_expenses
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- 5.3 Allow authenticated users to update expenses
DROP POLICY IF EXISTS "Allow authenticated users to update mss_expenses" ON public.mss_expenses;
CREATE POLICY "Allow authenticated users to update mss_expenses"
    ON public.mss_expenses
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5.4 Allow authenticated users to delete expenses
DROP POLICY IF EXISTS "Allow authenticated users to delete mss_expenses" ON public.mss_expenses;
CREATE POLICY "Allow authenticated users to delete mss_expenses"
    ON public.mss_expenses
    FOR DELETE
    TO authenticated
    USING (true);

-- 5.5 Service Role Full Access
DROP POLICY IF EXISTS "Allow service_role full access on mss_expenses" ON public.mss_expenses;
CREATE POLICY "Allow service_role full access on mss_expenses"
    ON public.mss_expenses
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Comments on table and schema
COMMENT ON TABLE public.mss_expenses IS 'Compu MSS Operating Expenses (salaries, utilities, maintenance, supplies, etc.)';
COMMENT ON COLUMN public.mss_expenses.amount IS 'Operating expense amount in EGP (must be positive, deducted from net profit)';
