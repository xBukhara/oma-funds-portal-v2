import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: Record<string, unknown>) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    }
  );
}

/** Returns the logged-in investor, or null */
export async function getInvestorSession() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: investor } = await supabase
    .from('investors')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return investor ?? null;
}

/** Validates the admin secret from the request header */
export function validateAdminSecret(req: Request): boolean {
  const secret = req.headers.get('x-admin-secret');
  return secret === process.env.ADMIN_SECRET;
}

/** Check admin cookie (set at login) */
export function isAdminAuthenticated(): boolean {
  const cookieStore = cookies();
  const adminToken = cookieStore.get('oma-admin-token')?.value;
  return adminToken === process.env.ADMIN_SECRET;
}
