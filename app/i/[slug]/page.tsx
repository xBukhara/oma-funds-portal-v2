import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import InvestorDashboard from '@/components/InvestorDashboard';

interface Props {
  params: { slug: string };
}

export default async function InvestorPage({ params }: Props) {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  // Use service client to bypass RLS for investor lookup
  const { createClient } = await import('@supabase/supabase-js');
  const serviceClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: investor } = await serviceClient
    .from('investors')
    .select('*')
    .eq('slug', params.slug)
    .eq('user_id', session.user.id)
    .single();

  if (!investor) redirect('/login');

  const { data: navRecords } = await serviceClient
    .from('nav_records')
    .select('*')
    .eq('investor_id', investor.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  const { data: latestStatement } = await serviceClient
    .from('statements')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single();

  return (
    <InvestorDashboard
      investor={investor}
      navRecords={navRecords ?? []}
      latestStatement={latestStatement ?? null}
    />
  );
}
