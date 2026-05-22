import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

function auth(req: NextRequest) {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET;
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { seeds } = body as {
    seeds: { investor_id: string; nav: number; as_of_year: number; as_of_month: number }[]
  };

  if (!seeds || seeds.length === 0) {
    return NextResponse.json({ error: 'No seeds provided' }, { status: 400 });
  }

  const supabase = getServiceClient();
  const results: { investor_id: string; status: string; error?: string }[] = [];

  for (const seed of seeds) {
    try {
      const { error } = await supabase
        .from('nav_records')
        .upsert({
          investor_id: seed.investor_id,
          year: seed.as_of_year,
          month: seed.as_of_month,
          nav: seed.nav,
          monthly_return_pct: 0,
        }, { onConflict: 'investor_id,year,month' });

      await supabase
        .from('investors')
        .update({ starting_capital: seed.nav })
        .eq('id', seed.investor_id);

      if (error) {
        results.push({ investor_id: seed.investor_id, status: 'failed', error: error.message });
      } else {
        results.push({ investor_id: seed.investor_id, status: 'seeded' });
      }
    } catch (err) {
      results.push({
        investor_id: seed.investor_id,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  }

  return NextResponse.json({
    success: true,
    seeded: results.filter(r => r.status === 'seeded').length,
    failed: results.filter(r => r.status === 'failed').length,
    results,
  });
}
