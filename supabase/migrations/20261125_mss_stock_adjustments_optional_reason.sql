-- ==============================================================================
-- Migration: 20261125_mss_stock_adjustments_optional_reason.sql
-- Description: Make reason optional (nullable) in mss_stock_adjustments table
-- ==============================================================================

ALTER TABLE public.mss_stock_adjustments
  ALTER COLUMN reason DROP NOT NULL;
