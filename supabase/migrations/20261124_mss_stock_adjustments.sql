-- ==============================================================================
-- Migration: 20261124_mss_stock_adjustments.sql
-- Description: Create mss_stock_adjustments table for tracking inventory quantity corrections
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.mss_stock_adjustments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  model_id TEXT NOT NULL,
  model_name TEXT,
  brand TEXT,
  stock_location TEXT NOT NULL,
  device_id TEXT,
  previous_quantity INTEGER NOT NULL DEFAULT 0,
  new_quantity INTEGER NOT NULL DEFAULT 0,
  adjustment_amount INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  actor_id TEXT,
  actor_username TEXT DEFAULT 'مستخدم النظام',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mss_stock_adjustments_model_id ON public.mss_stock_adjustments (model_id);
CREATE INDEX IF NOT EXISTS idx_mss_stock_adjustments_stock_location ON public.mss_stock_adjustments (stock_location);
CREATE INDEX IF NOT EXISTS idx_mss_stock_adjustments_created_at ON public.mss_stock_adjustments (created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.mss_stock_adjustments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated and anon users to read and insert adjustments (managed by app)
DROP POLICY IF EXISTS "Allow read mss_stock_adjustments" ON public.mss_stock_adjustments;
CREATE POLICY "Allow read mss_stock_adjustments" ON public.mss_stock_adjustments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow insert mss_stock_adjustments" ON public.mss_stock_adjustments;
CREATE POLICY "Allow insert mss_stock_adjustments" ON public.mss_stock_adjustments
  FOR INSERT WITH CHECK (true);

GRANT ALL ON public.mss_stock_adjustments TO anon, authenticated, service_role;
