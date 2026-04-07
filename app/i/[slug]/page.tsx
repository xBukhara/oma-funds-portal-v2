import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/auth';
import InvestorDashboard from '@/components/InvestorDashboard';

interface Props {
  params: { slug: string };
}

export default async function InvestorPage({ params }: Props) {
  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Verify this slug belongs to the logged-in user
  const { data: investor } = await supabase
    .from('investors')
    .select('*')
    .eq('slug', params.slug)
    .eq('user_id', user.id)
    .single();

  if (!investor) redirect('/login');

  // Fetch their NAV records sorted chronologically
  const { data: navRecords } = await supabase
    .from('nav_records')
    .select('*')
    .eq('investor_id', investor.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  // Fetch latest statement info
  const { data: latestStatement } = await supabase
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
