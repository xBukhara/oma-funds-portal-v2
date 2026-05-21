import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

interface InvestorRow {
  name: string;
  email: string;
  slug: string;
  starting_capital: number;
  share_pct: number;
  temp_password: string;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { investors }: { investors: InvestorRow[] } = body;

  if (!investors || investors.length === 0) {
    return NextResponse.json({ error: 'No investors provided' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const results: { name: string; email: string; status: string; error?: string }[] = [];

  for (const investor of investors) {
    try {
      if (!investor.name || !investor.slug || !investor.starting_capital || !investor.temp_password) {
        results.push({ name: investor.name ?? 'Unknown', email: investor.email ?? '', status: 'failed', error: 'Missing required fields' });
        continue;
      }

      if (!investor.email) {
        results.push({ name: investor.name, email: '', status: 'skipped', error: 'No email — add later' });
        continue;
      }

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: investor.email,
        password: investor.temp_password,
        email_confirm: true,
        user_metadata: { force_password_change: true, full_name: investor.name },
      });

      if (authError) {
        results.push({ name: investor.name, email: investor.email, status: 'failed', error: authError.message });
        continue;
      }

      const { error: invError } = await supabase.from('investors').insert({
        user_id: authUser.user.id,
        name: investor.name,
        email: investor.email,
        slug: investor.slug.toLowerCase().replace(/\s+/g, '-'),
        starting_capital: investor.starting_capital,
        share_pct: investor.share_pct ?? 0,
      });

      if (invError) {
        await supabase.auth.admin.deleteUser(authUser.user.id);
        results.push({ name: investor.name, email: investor.email, status: 'failed', error: invError.message });
        continue;
      }

      results.push({ name: investor.name, email: investor.email, status: 'created' });

    } catch (err) {
      results.push({ name: investor.name ?? 'Unknown', email: investor.email ?? '', status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error' });
    }
  }

  // Recalculate share percentages
  const { data: allInvestors } = await supabase.from('investors').select('id, starting_capital');
  if (allInvestors && allInvestors.length > 0) {
    const totalCapital = allInvestors.reduce((sum, inv) => sum + inv.starting_capital, 0);
    for (const inv of allInvestors) {
      const newSharePct = totalCapital > 0 ? (inv.starting_capital / totalCapital) * 100 : 0;
      await supabase.from('investors').update({ share_pct: parseFloat(newSharePct.toFixed(4)) }).eq('id', inv.id);
    }
  }

  const created = results.filter(r => r.status === 'created').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const skipped = results.filter(r => r.status === 'skipped').length;

  return NextResponse.json({ results, created, failed, skipped });
}
