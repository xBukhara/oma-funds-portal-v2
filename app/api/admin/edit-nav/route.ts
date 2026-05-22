import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { investor_id, new_nav, note } = body;

  if (!investor_id || !new_nav) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Get current NAV
  const { data: latestNav } = await supabase
    .from('nav_records')
    .select('*')
    .eq('investor_id', investor_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single();

  const oldNav = latestNav?.nav ?? 0;

  // Update the latest nav_record
  if (latestNav) {
    await supabase
      .from('nav_records')
      .update({ nav: new_nav })
      .eq('id', latestNav.id);
  }

  // Update investor starting_capital
  await supabase
    .from('investors')
    .update({ starting_capital: new_nav })
    .eq('id', investor_id);

  // Log as admin adjustment
  await supabase.from('account_transactions').insert({
    investor_id,
    type: new_nav > oldNav ? 'deposit' : 'withdrawal',
    amount: Math.abs(new_nav - oldNav),
    nav_before: oldNav,
    nav_after: new_nav,
    note: note ?? 'Admin NAV adjustment',
  });

  return NextResponse.json({ success: true, old_nav: oldNav, new_nav });
}
