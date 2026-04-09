import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 
  process.env.SUPABASE_URL!;

const supabaseAnonKey = 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 
  process.env.SUPABASE_ANON_KEY!;

// Browser client (uses anon key + RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server/admin client (uses service role key — bypasses RLS)
// Only import this in API routes, never in client components
export function getServiceClient() {
  const serviceKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? 
    process.env.SUPABASE_SECRET_KEY!;

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
