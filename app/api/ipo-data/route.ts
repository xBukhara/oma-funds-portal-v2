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

  const { data: holdings } = await supabase
    .from('ipo_holdings')
    .select('*')
    .eq('investor_id', investor.id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    investor: { name: investor.name, slug: investor.slug },
    holdings: holdings ?? [],
  });
}
