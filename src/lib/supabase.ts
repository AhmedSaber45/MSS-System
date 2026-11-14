import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  'https://ylareolroigqcglayeyg.supabase.co';
const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYXJlb2xyb2lncWNnbGF5ZXlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2NDU2MTAsImV4cCI6MjExMDIyMTYxMH0.-FaT4QG9i6zkSMddr7TDzB1dfqabUJlQC1nv6hosAmc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const SUPABASE_CONFIG = {
  projectRef: 'ylareolroigqcglayeyg',
  projectName: "MSS System's Project",
  organizationId: 'vljqhjbbymsbopjvrmnv',
  url: supabaseUrl,
};
