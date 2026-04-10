import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const userId = req.headers.get('x-user-id');
  const slug = req.nextUrl.searchParams.get('slug');

  if (!userId || !slug) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: investor, error: invError } = await supabase
    .from('investors')
    .select('*')
    .eq('slug', slug)
    .eq('user_id', userId)
    .single();

  if (invError || !investor) {
    return NextResponse.json({ error: 'Investor not found' }, { status: 404 });
  }

  const { data: navRecords } = await supabase
    .from('nav_records')
    .select('*')
    .eq('investor_id', investor.id)
    .order('year', { ascending: true })
    .order('month', { ascending: true });

  const { data: latestStatement } = await supabase
    .from('statements')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    investor,
    navRecords: navRecords ?? [],
    latestStatement: latestStatement ?? null,
  });
}
