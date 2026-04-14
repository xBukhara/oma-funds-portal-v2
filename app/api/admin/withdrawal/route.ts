import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { investor_id, amount, type, note } = body;
  // type: 'withdrawal' | 'deposit'

  if (!investor_id || !amount || !type) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const supabase = getServiceClient();

  // Get investor's latest NAV
  const { data: investor } = await supabase
    .from('investors')
    .select('*')
    .eq('id', investor_id)
    .single();

  if (!investor) return NextResponse.json({ error: 'Investor not found' }, { status: 404 });

  // Get their latest NAV record
  const { data: latestNav } = await supabase
    .from('nav_records')
    .select('*')
    .eq('investor_id', investor_id)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single();

  const currentNav = latestNav?.nav ?? investor.starting_capital;
  const adjustedAmount = type === 'withdrawal' ? -Math.abs(amount) : Math.abs(amount);
  const newNav = currentNav + adjustedAmount;
  const newStartingCapital = investor.starting_capital + adjustedAmount;

  if (newNav < 0) {
    return NextResponse.json({ error: 'Withdrawal exceeds account balance' }, { status: 400 });
  }

  // Log the transaction
  await supabase.from('account_transactions').insert({
    investor_id,
    type,
    amount: Math.abs(amount),
    nav_before: currentNav,
    nav_after: newNav,
    note: note ?? null,
  });

  // Update investor starting capital
  await supabase
    .from('investors')
    .update({ starting_capital: newStartingCapital })
    .eq('id', investor_id);

  // Recalculate ALL investors' share percentages based on new starting capitals
  const { data: allInvestors } = await supabase
    .from('investors')
    .select('id, starting_capital');

  if (allInvestors && allInvestors.length > 0) {
    const totalCapital = allInvestors.reduce((sum, inv) => {
      return sum + (inv.id === investor_id ? newStartingCapital : inv.starting_capital);
    }, 0);

    // Update each investor's share_pct
    for (const inv of allInvestors) {
      const capital = inv.id === investor_id ? newStartingCapital : inv.starting_capital;
      const newSharePct = totalCapital > 0 ? (capital / totalCapital) * 100 : 0;
      await supabase
        .from('investors')
        .update({ share_pct: parseFloat(newSharePct.toFixed(4)) })
        .eq('id', inv.id);
    }
  }

  // Update latest nav_record to reflect new NAV
  if (latestNav) {
    await supabase
      .from('nav_records')
      .update({ nav: newNav })
      .eq('id', latestNav.id);
  }

  return NextResponse.json({
    success: true,
    investor_id,
    type,
    amount: Math.abs(amount),
    nav_before: currentNav,
    nav_after: newNav,
  });
}
