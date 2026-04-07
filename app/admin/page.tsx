import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/auth';
import { getServiceClient } from '@/lib/supabase';
import AdminPortal from '@/components/AdminPortal';

export default async function AdminPage() {
  if (!isAdminAuthenticated()) redirect('/admin/login');

  const supabase = getServiceClient();

  const [
    { data: investors },
    { data: fundReturns },
    { data: statements },
    { data: emailLog },
  ] = await Promise.all([
    supabase.from('investors').select('*').order('created_at', { ascending: false }),
    supabase.from('fund_returns').select('*').order('year').order('month'),
    supabase.from('statements').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('email_log').select('*, investors(name, email)').order('sent_at', { ascending: false }).limit(50),
  ]);

  return (
    <AdminPortal
      investors={investors ?? []}
      fundReturns={fundReturns ?? []}
      statements={statements ?? []}
      emailLog={emailLog ?? []}
    />
  );
}
