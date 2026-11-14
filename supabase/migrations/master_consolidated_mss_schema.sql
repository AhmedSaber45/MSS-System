-- ==============================================================================
-- MASTER CONSOLIDATED MIGRATION: MSS BUSINESS DATABASE (PHASES 06 - 09)
-- File: supabase/migrations/master_consolidated_mss_schema.sql
-- Description: Complete, safe, idempotent PostgreSQL schema for the shared MSS business:
--              1. Shared Catalog Models (mss_models)
--              2. Individual Physical Inventory Units with Serials (mss_devices)
--              3. Inter-Shop Physical Movement History (mss_movements)
--              4. Sales Invoices with Price Snapshots (mss_invoices)
--              5. Cross-Shop Reservations (mss_reservations)
--              6. Sales Returns & Reversals (mss_returns)
--              7. Offline Sync Operation Outbox (mss_sync_log)
--              8. Disconnected Conflict Log & Resolutions (mss_conflicts)
--              9. Availability View (vw_mss_model_availability)
--              10. Complete Row Level Security (RLS) policies and Indexes
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Execution: Safe to execute in Supabase SQL Editor (all statements idempotent)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Timestamp trigger function
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

CREATE INDEX IF NOT EXISTS idx_mss_models_brand ON public.mss_models(brand);
CREATE INDEX IF NOT EXISTS idx_mss_models_category ON public.mss_models(category);
CREATE INDEX IF NOT EXISTS idx_mss_models_model_name ON public.mss_models(model_name);
CREATE INDEX IF NOT EXISTS idx_mss_models_created_at ON public.mss_models(created_at DESC);

DROP TRIGGER IF EXISTS trg_mss_models_updated ON public.mss_models;
CREATE TRIGGER trg_mss_models_updated
    BEFORE UPDATE ON public.mss_models
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 4. Table: mss_devices (Physical Device Units with Unique Serials)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    serial_number TEXT NOT NULL UNIQUE,
    model_id UUID NOT NULL REFERENCES public.mss_models(id) ON DELETE RESTRICT,
    purchase_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_cost >= 0),
    list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (list_price >= 0),
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    physical_condition TEXT NOT NULL DEFAULT 'فرز أول ممتاز',
    stock_location TEXT NOT NULL CHECK (stock_location IN ('محل 1', 'محل 2')),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'RESERVED', 'SOLD', 'MAINTENANCE', 'RETURNED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mss_devices_serial ON public.mss_devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_devices_model_id ON public.mss_devices(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_devices_location_status ON public.mss_devices(stock_location, status);
CREATE INDEX IF NOT EXISTS idx_mss_devices_status ON public.mss_devices(status);

DROP TRIGGER IF EXISTS trg_mss_devices_updated ON public.mss_devices;
CREATE TRIGGER trg_mss_devices_updated
    BEFORE UPDATE ON public.mss_devices
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 5. Table: mss_movements (Physical Transfers Between Shops)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES public.mss_devices(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    from_location TEXT NOT NULL CHECK (from_location IN ('محل 1', 'محل 2')),
    to_location TEXT NOT NULL CHECK (to_location IN ('محل 1', 'محل 2')),
    movement_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    movement_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (movement_status IN ('PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_diff_locations CHECK (from_location <> to_location)
);

CREATE INDEX IF NOT EXISTS idx_mss_movements_device ON public.mss_movements(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_movements_serial ON public.mss_movements(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_movements_date ON public.mss_movements(movement_date DESC);

-- ==============================================================================
-- 6. Table: mss_invoices (Sales Invoices with Price & Cost Snapshots)
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

CREATE INDEX IF NOT EXISTS idx_mss_invoices_number ON public.mss_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_serial ON public.mss_invoices(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_device ON public.mss_invoices(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_model ON public.mss_invoices(model_id);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_selling_branch ON public.mss_invoices(selling_branch);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_source_branch ON public.mss_invoices(source_branch);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_sale_date ON public.mss_invoices(sale_date DESC);
CREATE INDEX IF NOT EXISTS idx_mss_invoices_is_returned ON public.mss_invoices(is_returned);

DROP TRIGGER IF EXISTS trg_mss_invoices_updated ON public.mss_invoices;
CREATE TRIGGER trg_mss_invoices_updated
    BEFORE UPDATE ON public.mss_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 7. Table: mss_reservations (Device Reservations)
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
    reservation_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    expiry_date TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FULFILLED', 'CANCELLED', 'EXPIRED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mss_reservations_number ON public.mss_reservations(reservation_number);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_device ON public.mss_reservations(device_id);
CREATE INDEX IF NOT EXISTS idx_mss_reservations_status ON public.mss_reservations(status);

DROP TRIGGER IF EXISTS trg_mss_reservations_updated ON public.mss_reservations;
CREATE TRIGGER trg_mss_reservations_updated
    BEFORE UPDATE ON public.mss_reservations
    FOR EACH ROW
    EXECUTE FUNCTION update_mss_timestamp();

-- ==============================================================================
-- 8. Table: mss_returns (Sales Returns & Device Restocking)
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
    new_status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (new_status IN ('AVAILABLE', 'MAINTENANCE', 'RETURNED')),
    notes TEXT,
    return_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mss_returns_number ON public.mss_returns(return_number);
CREATE INDEX IF NOT EXISTS idx_mss_returns_invoice ON public.mss_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_mss_returns_device ON public.mss_returns(device_id);

-- ==============================================================================
-- 9. Table: mss_sync_log (Offline-First Outbox Synchronization)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_uuid UUID NOT NULL UNIQUE,
    operation_type TEXT NOT NULL CHECK (operation_type IN (
        'SALE_CREATE', 'RESERVATION_CREATE', 'RESERVATION_CANCEL', 
        'RETURN_PROCESS', 'DEVICE_ADD', 'DEVICE_TRANSFER'
    )),
    branch TEXT NOT NULL CHECK (branch IN ('محل 1', 'محل 2')),
    payload JSONB NOT NULL,
    client_timestamp TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'SYNCED' CHECK (status IN (
        'PENDING', 'SYNCING', 'SYNCED', 'CONFLICT', 'FAILED', 'RESOLVED'
    )),
    conflict_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mss_sync_uuid ON public.mss_sync_log(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_mss_sync_status ON public.mss_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_mss_sync_branch ON public.mss_sync_log(branch);
CREATE INDEX IF NOT EXISTS idx_mss_sync_type ON public.mss_sync_log(operation_type);

-- ==============================================================================
-- 10. Table: mss_conflicts (Disconnected Concurrency Conflict Management)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.mss_conflicts (
    id TEXT PRIMARY KEY,
    operation_uuid UUID NOT NULL REFERENCES public.mss_sync_log(operation_uuid) ON DELETE CASCADE,
    device_id UUID REFERENCES public.mss_devices(id) ON DELETE SET NULL,
    serial_number TEXT NOT NULL,
    branch TEXT NOT NULL CHECK (branch IN ('محل 1', 'محل 2')),
    conflict_type TEXT NOT NULL CHECK (conflict_type IN (
        'DOUBLE_SALE', 'DOUBLE_RESERVATION', 'STALE_STOCK_TRANSFER', 'PRICE_MISMATCH', 'OTHER'
    )),
    conflict_description TEXT NOT NULL,
    local_payload JSONB NOT NULL,
    remote_state JSONB,
    resolution_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (resolution_status IN (
        'PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED_MANUALLY'
    )),
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_mss_conflicts_op_uuid ON public.mss_conflicts(operation_uuid);
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_serial ON public.mss_conflicts(serial_number);
CREATE INDEX IF NOT EXISTS idx_mss_conflicts_resolution ON public.mss_conflicts(resolution_status);

-- ==============================================================================
-- 11. View: vw_mss_model_availability
-- ==============================================================================
CREATE OR REPLACE VIEW public.vw_mss_model_availability AS
SELECT 
    m.id AS model_id,
    m.brand,
    m.model_name,
    m.category,
    m.default_list_price,
    COUNT(d.id) FILTER (WHERE d.status = 'AVAILABLE' AND d.stock_location = 'محل 1') AS available_shop1,
    COUNT(d.id) FILTER (WHERE d.status = 'AVAILABLE' AND d.stock_location = 'محل 2') AS available_shop2,
    COUNT(d.id) FILTER (WHERE d.status = 'AVAILABLE') AS total_available,
    COUNT(d.id) FILTER (WHERE d.status = 'RESERVED') AS reserved_count,
    COUNT(d.id) FILTER (WHERE d.status = 'SOLD') AS sold_count
FROM public.mss_models m
LEFT JOIN public.mss_devices d ON m.id = d.model_id
GROUP BY m.id, m.brand, m.model_name, m.category, m.default_list_price;

-- ==============================================================================
-- 12. Enable Row Level Security (RLS) & Policies
-- ==============================================================================
ALTER TABLE public.mss_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_conflicts ENABLE ROW LEVEL SECURITY;

-- Models RLS Policies
DROP POLICY IF EXISTS "Public can view models" ON public.mss_models;
CREATE POLICY "Public can view models" ON public.mss_models FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert models" ON public.mss_models;
CREATE POLICY "Public can insert models" ON public.mss_models FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update models" ON public.mss_models;
CREATE POLICY "Public can update models" ON public.mss_models FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public can delete models" ON public.mss_models;
CREATE POLICY "Public can delete models" ON public.mss_models FOR DELETE TO anon, authenticated USING (true);

-- Devices RLS Policies
DROP POLICY IF EXISTS "Public can view devices" ON public.mss_devices;
CREATE POLICY "Public can view devices" ON public.mss_devices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert devices" ON public.mss_devices;
CREATE POLICY "Public can insert devices" ON public.mss_devices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update devices" ON public.mss_devices;
CREATE POLICY "Public can update devices" ON public.mss_devices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Public can delete available devices" ON public.mss_devices;
CREATE POLICY "Public can delete available devices" ON public.mss_devices FOR DELETE TO anon, authenticated USING (status <> 'SOLD');

-- Movements RLS Policies
DROP POLICY IF EXISTS "Public can view movements" ON public.mss_movements;
CREATE POLICY "Public can view movements" ON public.mss_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert movements" ON public.mss_movements;
CREATE POLICY "Public can insert movements" ON public.mss_movements FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Invoices RLS Policies
DROP POLICY IF EXISTS "Public can view invoices" ON public.mss_invoices;
CREATE POLICY "Public can view invoices" ON public.mss_invoices FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert invoices" ON public.mss_invoices;
CREATE POLICY "Public can insert invoices" ON public.mss_invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update invoices" ON public.mss_invoices;
CREATE POLICY "Public can update invoices" ON public.mss_invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Reservations RLS Policies
DROP POLICY IF EXISTS "Public can view reservations" ON public.mss_reservations;
CREATE POLICY "Public can view reservations" ON public.mss_reservations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert reservations" ON public.mss_reservations;
CREATE POLICY "Public can insert reservations" ON public.mss_reservations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update reservations" ON public.mss_reservations;
CREATE POLICY "Public can update reservations" ON public.mss_reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Returns RLS Policies
DROP POLICY IF EXISTS "Public can view returns" ON public.mss_returns;
CREATE POLICY "Public can view returns" ON public.mss_returns FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert returns" ON public.mss_returns;
CREATE POLICY "Public can insert returns" ON public.mss_returns FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Sync Log & Conflicts RLS Policies
DROP POLICY IF EXISTS "Public can view sync logs" ON public.mss_sync_log;
CREATE POLICY "Public can view sync logs" ON public.mss_sync_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert sync logs" ON public.mss_sync_log;
CREATE POLICY "Public can insert sync logs" ON public.mss_sync_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update sync logs" ON public.mss_sync_log;
CREATE POLICY "Public can update sync logs" ON public.mss_sync_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view conflicts" ON public.mss_conflicts;
CREATE POLICY "Public can view conflicts" ON public.mss_conflicts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert conflicts" ON public.mss_conflicts;
CREATE POLICY "Public can insert conflicts" ON public.mss_conflicts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update conflicts" ON public.mss_conflicts;
CREATE POLICY "Public can update conflicts" ON public.mss_conflicts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ==============================================================================
-- 13. Seed Initial Verification Records
-- ==============================================================================
INSERT INTO public.mss_models (id, brand, model_name, category, processor, ram, storage, screen_size, specifications, default_list_price)
VALUES 
    ('a0000000-0000-0000-0000-000000000001', 'Lenovo', 'ThinkPad T480', 'لابتوب', 'Intel Core i5-8350U', '16 GB DDR4', '256 GB NVMe SSD', '14" FHD IPS', 'بطارية مزدوجة، كيبورد مضيئة', 11500.00),
    ('a0000000-0000-0000-0000-000000000002', 'Dell', 'Latitude 5420', 'لابتوب', 'Intel Core i5-1145G7', '16 GB DDR4', '512 GB NVMe SSD', '14" FHD Anti-Glare', 'الجيل الحادي عشر، شاحن تايب سي', 15000.00),
    ('a0000000-0000-0000-0000-000000000003', 'HP', 'EliteBook 840 G6', 'لابتوب', 'Intel Core i7-8665U', '16 GB DDR4', '512 GB NVMe SSD', '14" FHD IPS', 'فرز أول كور i7، صوت Bang & Olufsen', 13500.00),
    ('a0000000-0000-0000-0000-000000000004', 'Dell', 'UltraSharp 24 Monitor', 'شاشة', NULL, NULL, NULL, '24" FHD IPS 60Hz', 'شاشة احترافية مصممة للرسوميات والإنتاجية', 4200.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mss_devices (id, serial_number, model_id, purchase_cost, list_price, purchase_date, physical_condition, stock_location, status, notes)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'PF1K892-LEN', 'a0000000-0000-0000-0000-000000000001', 8200.00, 11500.00, CURRENT_DATE - 10, 'فرز أول ممتاز بحالة الزيرو', 'محل 1', 'AVAILABLE', 'جاهز للعرض والبيع الفوري'),
    ('b0000000-0000-0000-0000-000000000002', 'PF1K893-LEN', 'a0000000-0000-0000-0000-000000000001', 8200.00, 11500.00, CURRENT_DATE - 10, 'فرز أول ممتاز', 'محل 2', 'AVAILABLE', 'بطارية داخلية وخارجية أصلية'),
    ('b0000000-0000-0000-0000-000000000003', '8F9X021-DELL', 'a0000000-0000-0000-0000-000000000002', 11000.00, 15000.00, CURRENT_DATE - 5, 'فرز أول بحالة المصنع', 'محل 1', 'AVAILABLE', 'شاحن 65 واط أصلي Type-C'),
    ('b0000000-0000-0000-0000-000000000004', '8F9X022-DELL', 'a0000000-0000-0000-0000-000000000002', 11000.00, 15000.00, CURRENT_DATE - 5, 'فرز أول بدون أي ملاحظات', 'محل 2', 'AVAILABLE', 'مع كرتونة التغليف'),
    ('b0000000-0000-0000-0000-000000000005', '5CD9283-HP', 'a0000000-0000-0000-0000-000000000003', 9800.00, 13500.00, CURRENT_DATE - 8, 'فرز أول كيبورد مضيئة', 'محل 2', 'SOLD', 'تم البيع للعميل شريف'),
    ('b0000000-0000-0000-0000-000000000006', 'CN49129-MON', 'a0000000-0000-0000-0000-000000000004', 3100.00, 4200.00, CURRENT_DATE - 3, 'سليم تماماً خالي من الخدوش', 'محل 1', 'AVAILABLE', 'شاشة عرض مع كابل DisplayPort')
ON CONFLICT (serial_number) DO NOTHING;

INSERT INTO public.mss_invoices (
    id, invoice_number, device_id, serial_number, model_id, selling_branch, source_branch,
    list_price_snapshot, discount_amount, actual_sale_price, cost_snapshot, gross_profit,
    customer_name, customer_phone, warranty_period, notes, sale_date, is_returned
) VALUES (
    'd0000000-0000-0000-0000-000000000001', 'MSS-INV-101', 'b0000000-0000-0000-0000-000000000005', '5CD9283-HP',
    'a0000000-0000-0000-0000-000000000003', 'محل 1', 'محل 2',
    13500.00, 500.00, 13000.00, 9800.00, 3200.00,
    'أ. شريف كمال', '01012345678', 'ضمان شهر كامل', 'بيع جهاز مخزن بمحل 2 من خلال محل 1',
    timezone('utc', now() - INTERVAL '3 days'), false
) ON CONFLICT (invoice_number) DO NOTHING;

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
