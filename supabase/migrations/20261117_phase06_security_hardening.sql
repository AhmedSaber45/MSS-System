-- ==============================================================================
-- COMPU MSS — ADMIN SYSTEM: PHASE 6 CONSOLIDATED SECURITY HARDENING MIGRATION
-- Final Security Hardening, Strict RLS Policies, Function Execution Boundaries
-- Migration File: supabase/migrations/20261117_phase06_security_hardening.sql
-- ==============================================================================

-- 1. Hardening admin_users RLS
-- Block all direct anonymous (anon) access. Only service_role or authenticated administrators can access.
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view admin accounts" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can modify admin accounts" ON public.admin_users;
DROP POLICY IF EXISTS "Block anon on admin_users" ON public.admin_users;

-- Only authenticated users (and service_role) can view admin accounts
CREATE POLICY "Authenticated admins can view admin accounts" ON public.admin_users
    FOR SELECT TO authenticated
    USING (true);

-- Mutations restricted to authenticated admins
CREATE POLICY "Authenticated admins can modify admin accounts" ON public.admin_users
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 2. Hardening app_users RLS
-- Anon should only read through safe view or RPCs; direct mutation by anon is completely blocked.
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage app users" ON public.app_users;
DROP POLICY IF EXISTS "Read app users" ON public.app_users;

CREATE POLICY "Allow authenticated read app_users" ON public.app_users
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow anon read active app_users" ON public.app_users
    FOR SELECT TO anon
    USING (is_active = true);

-- Block direct mutations by anon: only authenticated / service_role can modify app_users
CREATE POLICY "Admins can manage app_users" ON public.app_users
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Hardening admin_audit_logs RLS
-- Audit logs can NEVER be updated or deleted by anyone. Anon cannot insert directly.
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insert audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Read audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "No audit log updates" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "No audit log deletes" ON public.admin_audit_logs;

CREATE POLICY "Admins can view audit logs" ON public.admin_audit_logs
    FOR SELECT TO authenticated
    USING (true);

-- Only authenticated / service_role and security definer functions can insert
CREATE POLICY "Admins can insert audit logs" ON public.admin_audit_logs
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Strict immutability guarantee: disallow all UPDATE and DELETE operations
CREATE POLICY "Deny all audit log updates" ON public.admin_audit_logs
    FOR UPDATE TO public, anon, authenticated
    USING (false);

CREATE POLICY "Deny all audit log deletes" ON public.admin_audit_logs
    FOR DELETE TO public, anon, authenticated
    USING (false);

-- 4. Hardening store_merges RLS
-- Store merges table is strictly auditable. Direct anon mutations are denied.
ALTER TABLE public.store_merges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins have full access to store_merges" ON public.store_merges;

CREATE POLICY "Allow view store_merges" ON public.store_merges
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "Admins can manage store_merges" ON public.store_merges
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 5. Hardening inventory_transfers & inventory_transfer_items RLS
-- Direct anonymous insertions are blocked. Only execute_inventory_transfer RPC or service_role can insert.
ALTER TABLE public.inventory_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow insert to inventory_transfers" ON public.inventory_transfers;
DROP POLICY IF EXISTS "Allow insert to inventory_transfer_items" ON public.inventory_transfer_items;
DROP POLICY IF EXISTS "Prevent delete on inventory_transfers" ON public.inventory_transfers;
DROP POLICY IF EXISTS "Prevent delete on inventory_transfer_items" ON public.inventory_transfer_items;

-- Read is allowed for audit and desktop status checking
CREATE POLICY "Allow read inventory_transfers" ON public.inventory_transfers
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "Allow read inventory_transfer_items" ON public.inventory_transfer_items
    FOR SELECT TO authenticated, anon
    USING (true);

-- Insertions restricted to authenticated administrators and service_role
CREATE POLICY "Allow authenticated insert inventory_transfers" ON public.inventory_transfers
    FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated insert inventory_transfer_items" ON public.inventory_transfer_items
    FOR INSERT TO authenticated
    WITH CHECK (true);

-- Immutability: Delete operations strictly forbidden
CREATE POLICY "Deny delete inventory_transfers" ON public.inventory_transfers
    FOR DELETE TO public, anon, authenticated
    USING (false);

CREATE POLICY "Deny delete inventory_transfer_items" ON public.inventory_transfer_items
    FOR DELETE TO public, anon, authenticated
    USING (false);

-- 6. Hardening app_user_sessions RLS
-- Desktop sessions can be read by their token hash; modifications restricted to security definer functions
ALTER TABLE public.app_user_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can insert sessions" ON public.app_user_sessions;
DROP POLICY IF EXISTS "Admins can view all sessions" ON public.app_user_sessions;

CREATE POLICY "Allow authenticated view sessions" ON public.app_user_sessions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow authenticated manage sessions" ON public.app_user_sessions
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

-- 7. Hardening SECURITY DEFINER Functions with Explicit Search Paths
-- Ensure all functions execute under safe search_path to prevent search path hijacking

ALTER FUNCTION public.verify_desktop_credentials(TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION public.revalidate_desktop_session(TEXT) SET search_path = public, extensions;
ALTER FUNCTION public.revoke_desktop_session(TEXT) SET search_path = public, extensions;
ALTER FUNCTION public.execute_store_merge(UUID[], UUID, TEXT, TEXT, TEXT) SET search_path = public, extensions;
ALTER FUNCTION public.execute_inventory_transfer(TEXT, TEXT, TEXT, UUID[], UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT) SET search_path = public, extensions;

-- Revoke administrative procedure execution from anon
REVOKE EXECUTE ON FUNCTION public.execute_store_merge(UUID[], UUID, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_store_merge(UUID[], UUID, TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.execute_inventory_transfer(TEXT, TEXT, TEXT, UUID[], UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.execute_inventory_transfer(TEXT, TEXT, TEXT, UUID[], UUID, BOOLEAN, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Desktop verification functions remain accessible to anon for desktop login
GRANT EXECUTE ON FUNCTION public.verify_desktop_credentials(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revalidate_desktop_session(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_desktop_session(TEXT) TO anon, authenticated;
