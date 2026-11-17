import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ylareolroigqcglayeyg.supabase.co';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYXJlb2xyb2lncWNnbGF5ZXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NDU2MTAsImV4cCI6MjExMDIyMTYxMH0.-FaT4QG9i6zkSMddr7TDzB1dfqabUJlQC1nv6hosAmc';

/**
 * Public/Client-side Supabase client
 * Restricted to anon permissions, uses RLS policies
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase client for Server Actions and API routes.
 * If SUPABASE_SERVICE_ROLE_KEY is set in private server env, uses it.
 * Otherwise falls back to anon key. Never leaks to browser.
 */
export function getServerSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const keyToUse = serviceKey || supabaseAnonKey;
  return createClient(supabaseUrl, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
