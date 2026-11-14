-- ==============================================================================
-- Migration: Phase 06 — MSS Cloud Foundation & Shared Product Catalog
-- File: supabase/migrations/20261114_phase06_mss_catalog.sql
-- Description: Creates the shared MSS product catalog and device inventory tables,
--              Row Level Security policies, indexes, and availability views.
-- Target: Supabase PostgreSQL (Project: MSS System's Project / ylareolroigqcglayeyg)
-- Safe to execute: YES (Idempotent with IF NOT EXISTS)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create updated_at trigger function if not already present
CREATE OR REPLACE FUNCTION update_mss_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. Table: mss_models (Shared Product Catalog Models)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    model_name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('لابتوب', 'شاشة', 'أخرى')),
    processor TEXT,
    ram TEXT,
    storage TEXT,
    screen_size TEXT,
    specifications TEXT,
    default_list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (default_list_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes for fast search and filtering in the catalog
CREATE INDEX IF NOT EXISTS idx_mss_models_brand ON public.mss_models(brand);
CREATE INDEX IF NOT EXISTS idx_mss_models_category ON public.mss_models(category);
CREATE INDEX IF NOT EXISTS idx_mss_models_model_name ON public.mss_models(model_name);
CREATE INDEX IF NOT EXISTS idx_mss_models_created_at ON public.mss_models(created_at DESC);

-- Trigger for auto-updating updated_at on mss_models
DROP TRIGGER IF EXISTS trg_mss_models_updated ON public.mss_models;
CREATE TRIGGER trg_mss_models_updated
    BEFORE UPDATE ON public.mss_models
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 4. Table: mss_devices (Physical Device Inventory Units tracked by Serial Number)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT NOT NULL UNIQUE,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_cost >= 0),
    list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (list_price >= 0),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    physical_condition TEXT NOT NULL DEFAULT 'فرز أول',
    stock_location TEXT NOT NULL CHECK (stock_location IN ('محل 1', 'محل 2')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'MAINTENANCE', 'RETURNED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Indexes on devices for high-speed serial scanner lookups and location tracking
CREATE INDEX IF NOT EXISTS idx_mss_devices_serial ON public.mss_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_devices_model ON public.mss_devices(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_devices_location ON public.mss_devices(stock_location);
CREATE INDEX IF NOT EXISTS idx_mss_devices_status ON public.mss_devices(status);
CREATE INDEX IF NOT EXISTS idx_mss_devices_created_at ON public.mss_devices(created_at DESC);

-- Trigger for auto-updating updated_at on mss_devices
DROP TRIGGER IF EXISTS trg_mss_devices_updated ON public.mss_devices;
CREATE TRIGGER trg_mss_devices_updated
    BEFORE UPDATE ON public.mss_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 5. View: mss_model_availability_view
-- Computes live availability separated by physical shop location
-- ==============================================================================
CREATE OR REPLACE VIEW public.mss_model_availability_view AS
SELECT
    m.id AS model_id,
    m.brand,
    m.model_name,
    m.category,
    m.processor,
    m.ram,
    m.storage,
    m.screen_size,
    m.default_list_price,
    COALESCE(SUM(CASE WHEN d.stock_location = 'محل 1' AND d.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0)::BIGINT AS available_shop1,
    COALESCE(SUM(CASE WHEN d.stock_location = 'محل 2' AND d.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0)::BIGINT AS available_shop2,
    COALESCE(SUM(CASE WHEN d.status = 'AVAILABLE' THEN 1 ELSE 0 END), 0)::BIGINT AS total_available,
    COALESCE(SUM(CASE WHEN d.status = 'RESERVED' THEN 1 ELSE 0 END), 0)::BIGINT AS reserved_count,
    COALESCE(SUM(CASE WHEN d.status = 'SOLD' THEN 1 ELSE 0 END), 0)::BIGINT AS sold_count
FROM public.mss_models m
LEFT JOIN public.mss_devices d ON m.id = d.model_id
GROUP BY m.id;

-- ==============================================================================
-- 6. Row Level Security (RLS) Configuration (Rule 11)
-- ==============================================================================
ALTER TABLE public.mss_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_devices ENABLE ROW LEVEL SECURITY;

-- Allow anon and authenticated clients full read access to shared catalog
DROP POLICY IF EXISTS "Allow public read access to mss_models" ON public.mss_models;
CREATE POLICY "Allow public read access to mss_models"
    ON public.mss_models
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow authenticated and anon desktop clients to insert models with validation
DROP POLICY IF EXISTS "Allow clients insert to mss_models" ON public.mss_models;
CREATE POLICY "Allow clients insert to mss_models"
    ON public.mss_models
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(trim(brand)) > 0 AND
        length(trim(model_name)) > 0 AND
        default_list_price >= 0
    );

-- Allow updates to models with validation
DROP POLICY IF EXISTS "Allow clients update to mss_models" ON public.mss_models;
CREATE POLICY "Allow clients update to mss_models"
    ON public.mss_models
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (
        length(trim(brand)) > 0 AND
        length(trim(model_name)) > 0 AND
        default_list_price >= 0
    );

-- Allow deletion of models only if no physical devices reference them
DROP POLICY IF EXISTS "Allow clients delete to mss_models" ON public.mss_models;
CREATE POLICY "Allow clients delete to mss_models"
    ON public.mss_models
    FOR DELETE
    TO anon, authenticated
    USING (
        NOT EXISTS (SELECT 1 FROM public.mss_devices WHERE model_id = public.mss_models.id)
    );

-- Policies for mss_devices
DROP POLICY IF EXISTS "Allow public read access to mss_devices" ON public.mss_devices;
CREATE POLICY "Allow public read access to mss_devices"
    ON public.mss_devices
    FOR SELECT
    TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "Allow clients insert to mss_devices" ON public.mss_devices;
CREATE POLICY "Allow clients insert to mss_devices"
    ON public.mss_devices
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        length(trim(serial_number)) > 0 AND
        purchase_cost >= 0 AND
        list_price >= 0 AND
        stock_location IN ('محل 1', 'محل 2')
    );

DROP POLICY IF EXISTS "Allow clients update to mss_devices" ON public.mss_devices;
CREATE POLICY "Allow clients update to mss_devices"
    ON public.mss_devices
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (
        purchase_cost >= 0 AND
        list_price >= 0 AND
        stock_location IN ('محل 1', 'محل 2')
    );

-- ==============================================================================
-- 7. Seed Initial Common Models (If catalog is empty)
-- ==============================================================================
INSERT INTO public.mss_models (id, brand, model_name, category, processor, ram, storage, screen_size, specifications, default_list_price)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Lenovo', 'ThinkPad T480', 'لابتوب', 'Intel Core i5-8350U', '16 GB DDR4', '256 GB NVMe SSD', '14" FHD IPS', 'بطارية مزدوجة، كيبورد مضيئة، كاميرا خصوصية ThinkShutter', 11500.00),
    ('a0000000-0000-0000-0000-000000000002', 'Dell', 'Latitude 5420', 'لابتوب', 'Intel Core i5-1145G7', '16 GB DDR4', '512 GB NVMe SSD', '14" FHD Anti-Glare', 'الجيل الحادي عشر، شاحن تايب سي، بصمة إصبع', 15000.00),
    ('a0000000-0000-0000-0000-000000000003', 'HP', 'EliteBook 840 G6', 'لابتوب', 'Intel Core i7-8665U', '16 GB DDR4', '512 GB NVMe SSD', '14" FHD IPS', 'هيكل ألومنيوم أنيق، صوت Bang & Olufsen فاخر', 13500.00),
    ('a0000000-0000-0000-0000-000000000004', 'Dell', 'UltraSharp U2419H', 'شاشة', '-', '-', '-', '24" FHD IPS InfinityEdge', 'شاشة احترافية مصممة لمصممي الجرافيك، حواف نحيفة جداً، حامل هيدروليك كامل', 4200.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Initial Device Units (If devices table is empty)
INSERT INTO public.mss_devices (id, serial_number, model_id, purchase_cost, list_price, purchase_date, physical_condition, stock_location, status, notes)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'PF1K892-LEN', 'a0000000-0000-0000-0000-000000000001', 8500.00, 11500.00, CURRENT_DATE - 5, 'فرز أول ممتاز', 'محل 2', 'AVAILABLE', 'حالة ممتازة - الشاحن الأصلي'),
    ('b0000000-0000-0000-0000-000000000002', 'PF1K893-LEN', 'a0000000-0000-0000-0000-000000000001', 8700.00, 11800.00, CURRENT_DATE - 4, 'فرز أول مع بطارية إضافية', 'محل 2', 'AVAILABLE', 'بطارية 95% صحة'),
    ('b0000000-0000-0000-0000-000000000003', '8F9X021-DELL', 'a0000000-0000-0000-0000-000000000002', 11000.00, 15000.00, CURRENT_DATE - 6, 'كالجديد كرتونة كاملة', 'محل 1', 'RESERVED', 'محجوز حتى الغد لعميل دائم'),
    ('b0000000-0000-0000-0000-000000000004', '8F9X022-DELL', 'a0000000-0000-0000-0000-000000000002', 10800.00, 14800.00, CURRENT_DATE - 3, 'فرز أول نظيف جداً', 'محل 1', 'AVAILABLE', 'جاهز للعرض'),
    ('b0000000-0000-0000-0000-000000000005', '5CD9283-HP', 'a0000000-0000-0000-0000-000000000003', 9800.00, 13500.00, CURRENT_DATE - 8, 'فرز أول كيبورد مضيئة', 'محل 2', 'SOLD', 'تم البيع للعميل شريف'),
    ('b0000000-0000-0000-0000-000000000006', 'CN49129-MON', 'a0000000-0000-0000-0000-000000000004', 3100.00, 4200.00, CURRENT_DATE - 2, 'سليم تماماً خالي من الخدوش', 'محل 1', 'AVAILABLE', 'شاشة عرض مع كابل DisplayPort')
ON CONFLICT (serial_number) DO NOTHING;
