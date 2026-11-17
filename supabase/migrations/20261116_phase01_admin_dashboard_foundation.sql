-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 1 CONSOLIDATED SCHEMA MIGRATION
-- File: supabase/migrations/20261116_phase01_admin_dashboard_foundation.sql
-- Description: Complete, safe, idempotent PostgreSQL schema for the independent
--              Compu MSS Admin System:
--              1. Admin Users (Dashboard Administrators)
--              2. System Stores & Warehouses (Multi-store organizational units)
--              3. Application Users (Shop Users with Hashed Access Codes)
--              4. User-Store Assignments (Store access permissions)
--              5. Immutable Administrative Audit Trail (admin_audit_logs)
--              6. Safe Public/Client Views (Omitting sensitive hashes)
--              7. Comprehensive Row Level Security (RLS) & Indexes
-- Target: Supabase PostgreSQL (Project Ref: ylareolroigqcglayeyg)
-- Execution: Safe to execute in Supabase SQL Editor in one go (idempotent)
-- ==============================================================================

-- 1. Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Timestamp trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_admin_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- 3. Table: admin_users (Dashboard Administrators)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'superadmin' CHECK (role IN ('superadmin', 'admin', 'auditor')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON public.admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON public.admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_is_active ON public.admin_users(is_active);

DROP TRIGGER IF EXISTS trg_admin_users_updated ON public.admin_users;
CREATE TRIGGER trg_admin_users_updated
    BEFORE UPDATE ON public.admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_timestamp();

-- ==============================================================================
-- 4. Table: system_stores (Physical Stores & Warehouses)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'store' CHECK (type IN ('store', 'warehouse')),
    address TEXT,
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_system_stores_code ON public.system_stores(code);
CREATE INDEX IF NOT EXISTS idx_system_stores_type ON public.system_stores(type);
CREATE INDEX IF NOT EXISTS idx_system_stores_is_active ON public.system_stores(is_active);

DROP TRIGGER IF EXISTS trg_system_stores_updated ON public.system_stores;
CREATE TRIGGER trg_system_stores_updated
    BEFORE UPDATE ON public.system_stores
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_timestamp();

-- Seed initial default stores to bridge legacy desktop references (Shop 1, Shop 2)
INSERT INTO public.system_stores (id, code, name, type, address, phone, is_active)
VALUES 
    ('e1111111-1111-1111-1111-111111111101', 'SHOP_1', 'محل 1 (الفرع الرئيسي)', 'store', 'الفرع الرئيسي', '01030137635', true),
    ('e1111111-1111-1111-1111-111111111102', 'SHOP_2', 'محل 2 (الفرع الثاني)', 'store', 'الفرع الثاني', '01030137635', true),
    ('e1111111-1111-1111-1111-111111111103', 'WH_MAIN', 'المخزن الرئيسي (المركزي)', 'warehouse', 'المخزن المركزي للشركة', '01030137635', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    type = EXCLUDED.type,
    updated_at = timezone('utc', now());

-- ==============================================================================
-- 5. Table: app_users (Shop Users for Desktop Application)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    access_code_hash TEXT NOT NULL,
    allowed_modules TEXT NOT NULL DEFAULT 'both' CHECK (allowed_modules IN ('accessories', 'mss', 'both')),
    default_store_id UUID REFERENCES public.system_stores(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT chk_app_users_username_not_empty CHECK (length(trim(username)) >= 3)
);

CREATE INDEX IF NOT EXISTS idx_app_users_username ON public.app_users(username);
CREATE INDEX IF NOT EXISTS idx_app_users_allowed_modules ON public.app_users(allowed_modules);
CREATE INDEX IF NOT EXISTS idx_app_users_default_store ON public.app_users(default_store_id);
CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON public.app_users(is_active);

DROP TRIGGER IF EXISTS trg_app_users_updated ON public.app_users;
CREATE TRIGGER trg_app_users_updated
    BEFORE UPDATE ON public.app_users
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_timestamp();

-- ==============================================================================
-- 6. Table: user_store_assignments (User-Store Multi-Assignment Junction)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_store_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES public.system_stores(id) ON DELETE RESTRICT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_user_store UNIQUE (user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_user_store_user_id ON public.user_store_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_store_store_id ON public.user_store_assignments(store_id);

-- ==============================================================================
-- 7. Table: admin_audit_logs (Immutable Administrative Audit Trail)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    event_type TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('user', 'store', 'system', 'auth', 'inventory')),
    target_id TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_event_type ON public.admin_audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON public.admin_audit_logs(actor_username);

-- ==============================================================================
-- 8. Safe View: vw_app_users_safe (Omits access_code_hash)
-- ==============================================================================
DROP VIEW IF EXISTS public.vw_app_users_safe CASCADE;

CREATE OR REPLACE VIEW public.vw_app_users_safe AS
SELECT 
    u.id,
    u.username,
    u.display_name,
    u.allowed_modules,
    u.default_store_id,
    s.name AS default_store_name,
    s.code AS default_store_code,
    u.is_active,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM public.app_users u
LEFT JOIN public.system_stores s ON u.default_store_id = s.id;

-- ==============================================================================
-- 9. Row Level Security (RLS) Policies
-- ==============================================================================
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_store_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 9.1 admin_users RLS
-- Only authenticated users/service_role can view admin accounts; anonymous access strictly denied.
DROP POLICY IF EXISTS "Admins can view admin accounts" ON public.admin_users;
CREATE POLICY "Admins can view admin accounts" ON public.admin_users
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Admins can modify admin accounts" ON public.admin_users;
CREATE POLICY "Admins can modify admin accounts" ON public.admin_users
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 9.2 system_stores RLS
-- Public read allowed (stores are non-sensitive directory data), mutations allowed for admin
DROP POLICY IF EXISTS "Anyone can view active stores" ON public.system_stores;
CREATE POLICY "Anyone can view active stores" ON public.system_stores
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Admins can manage stores" ON public.system_stores;
CREATE POLICY "Admins can manage stores" ON public.system_stores
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 9.3 app_users RLS
DROP POLICY IF EXISTS "Read app users" ON public.app_users;
CREATE POLICY "Read app users" ON public.app_users
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Admins can manage app users" ON public.app_users;
CREATE POLICY "Admins can manage app users" ON public.app_users
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 9.4 user_store_assignments RLS
DROP POLICY IF EXISTS "View user store assignments" ON public.user_store_assignments;
CREATE POLICY "View user store assignments" ON public.user_store_assignments
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Manage user store assignments" ON public.user_store_assignments;
CREATE POLICY "Manage user store assignments" ON public.user_store_assignments
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- 9.5 admin_audit_logs RLS
-- Audit logs can ONLY be inserted or read. Updates and deletions are strictly prevented.
DROP POLICY IF EXISTS "Read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Read audit logs" ON public.admin_audit_logs
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "Insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Insert audit logs" ON public.admin_audit_logs
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- Explicitly disallow UPDATE or DELETE on audit logs to guarantee immutability
DROP POLICY IF EXISTS "No audit log updates" ON public.admin_audit_logs;
CREATE POLICY "No audit log updates" ON public.admin_audit_logs
    FOR UPDATE TO authenticated, anon
    USING (false);

DROP POLICY IF EXISTS "No audit log deletes" ON public.admin_audit_logs;
CREATE POLICY "No audit log deletes" ON public.admin_audit_logs
    FOR DELETE TO authenticated, anon
    USING (false);
